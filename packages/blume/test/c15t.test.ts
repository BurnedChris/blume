import { expect, it, mock } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Script } from "@c15t/core";

import { analyticsClientModule } from "../src/analytics/c15t.ts";
import * as analytics from "../src/analytics/index.ts";
import {
  googleTagManager,
  posthog,
  script,
  segment,
  vercel,
} from "../src/analytics/index.ts";
import { c15t, ethyca, native, osano } from "../src/consent/index.ts";
import type { ConsentClientOptions } from "../src/consent/index.ts";
import { blumeConsentIntegrations } from "../src/consent/integration.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";

it("keeps zero-config sites free of a consent runtime and activates offline consent for GTM", () => {
  expect(blumeConfigSchema.parse({}).consent).toBeNull();
  expect(
    blumeConfigSchema.parse({
      analytics: [googleTagManager({ id: "GTM-TEST" })],
    }).consent
  ).toEqual(c15t());
});
it("preserves explicit consent authorities and hosted mode", () => {
  for (const consent of [
    native(),
    osano({ configId: "b", customerId: "a" }),
    ethyca({ privacyCenter: "https://privacy.example.com" }),
    c15t({ mode: { type: "hosted", url: "https://consent.example.com" } }),
  ]) {
    expect(
      blumeConfigSchema.parse({ analytics: [vercel()], consent }).consent
    ).toEqual(consent);
    expect(
      blumeConsentIntegrations({ analytics: [], consent, root: "/site" }).map(
        (i) => i.name
      )
    ).toContain("blume:consent");
  }
});
it("rejects callback-bearing config instead of losing functions in JSON", () => {
  expect(
    blumeConfigSchema.safeParse({
      consent: {
        ...c15t(),
        options: {
          callbacks: {
            onLoad: () => {
              // Invalid config intentionally.
            },
          },
          mode: { type: "offline" },
        },
      },
    }).success
  ).toBe(false);
});
it("compiles selected SDK imports, custom script content and pageview ownership", () => {
  const source = analyticsClientModule([
    googleTagManager({ dataLayer: "customLayer", id: "GTM-TEST" }),
    posthog({ capture_pageview: "history_change", key: "ph" }),
    segment({
      cdn: "https://proxy.example.com",
      integrations: { All: false },
      key: "seg",
    }),
    script({ content: "window.custom = true" }),
    vercel(),
    vercel(),
  ]);
  expect(source).toContain('from "blume/scripts/google-tag-manager"');
  expect(source).toContain('"dataLayer":"customLayer"');
  expect(source).toContain('"apiHost":"https://us.i.posthog.com"');
  expect(source).toContain('"textContent":"window.custom = true"');
  expect(source).toContain('export const pageviews = ["segment"]');
  expect(
    source.match(/from "blume\/scripts\/vercel-analytics"/gu)
  ).toHaveLength(1);
});

it("runs every legacy adapter through the actual c15t SDK and preserves loader options", async () => {
  const adapters = [
    analytics.adobe({ url: "https://cdn.example.com/launch.js" }),
    analytics.amplitude({ key: "amp" }),
    analytics.clarity({ id: "clarity" }),
    analytics.clearbit({ key: "clear" }),
    analytics.cloudflare({ token: "cf" }),
    analytics.databuddy({ clientId: "buddy", track_hash: "true" }),
    analytics.fathom({ honor_dnt: "true", site: "site" }),
    analytics.googleAnalytics({ id: "G-TEST", send_page_view: false }),
    analytics.googleTagManager({ id: "GTM-TEST" }),
    analytics.heap({ id: "heap", secureCookie: true }),
    analytics.hightouch({ host: "https://events.example.com", key: "ht" }),
    analytics.hotjar({ id: 123, version: 6 }),
    analytics.logrocket({ id: "org/app", release: "1" }),
    analytics.mixpanel({
      region: "eu",
      token: "0123456789abcdef0123456789abcdef",
    }),
    analytics.oneDollarStats({ hostname: "docs.example.com" }),
    analytics.pirsch({ code: "pirsch", disable: "true" }),
    analytics.plausible({
      domain: "docs.example.com",
      host: "https://proxy.example.com/",
      outbound_links: "true",
    }),
    analytics.posthog({ key: "ph" }),
    analytics.segment({ key: "seg" }),
    analytics.vercel({ dsn: "dsn" }),
    analytics.script({ src: "https://custom.example.com/script.js" }),
  ];
  const source = analyticsClientModule(adapters).replaceAll(
    /"blume\/scripts\/(?<subpath>[^"\n]+)"/gu,
    (_, name: string) =>
      JSON.stringify(new URL(`../src/scripts/${name}.ts`, import.meta.url).href)
  );
  // SAFETY: this is our generated module. Executing it checks real SDK option
  // contracts and subpath exports without executing third-party network code.
  const root = await mkdtemp(path.join(tmpdir(), "blume-sdk-"));
  const modulePath = path.join(root, "scripts.mjs");
  await writeFile(modulePath, source);
  // SAFETY: analyticsClientModule emits precisely these named exports.
  const result = (await import(modulePath)) as {
    scripts: Script[];
    pageviews: string[];
  };
  await rm(root, { force: true, recursive: true });
  expect(result.scripts).toHaveLength(adapters.length);
  expect(result.scripts.every((entry) => entry.id && entry.category)).toBe(
    true
  );
  expect(
    result.scripts.find((entry) => entry.vendor === "plausible-analytics")?.src
  ).toBe("https://proxy.example.com/js/script.js");
  expect(
    result.scripts.find((entry) => entry.vendor === "vercel-analytics")?.src
  ).toBe("/_vercel/insights/script.js");
  expect(
    result.scripts.find((entry) => entry.vendor === "databuddy")?.attributes?.[
      "data-track_hash"
    ]
  ).toBe("true");
  expect(result.pageviews).toEqual(["hightouch", "posthog", "segment"]);
  // SAFETY: exercises the fail-fast boundary for corrupted serialized config.
  expect(() => analyticsClientModule([{ kind: "invalid" } as never])).toThrow(
    "Unknown analytics adapter"
  );
});

it("wires the Astro client module, preserves callbacks, and suppresses legacy trackers in dev", async () => {
  for (const command of ["build", "dev"] as const) {
    for (const consent of [
      c15t({ clientEntrypoint: "consent.client.ts" }),
      native({ policy: "/privacy" }),
      native({ policy: "https://example.com/privacy" }),
    ]) {
      const integration = blumeConsentIntegrations({
        analytics: [vercel()],
        basePath: "/docs",
        consent,
        root: "/site with spaces",
      }).find((entry) => entry.name === "blume:consent");
      const updateConfig = mock();
      const injectScript = mock();
      // SAFETY: this hook consumes only these three Astro setup fields.
      // oxlint-disable-next-line no-await-in-loop -- Each hook is checked independently with its own captured config.
      await integration?.hooks["astro:config:setup"]?.({
        command,
        injectScript,
        updateConfig,
      } as never);
      const plugin = updateConfig.mock.calls[0]?.[0].vite.plugins[0];
      expect(plugin.resolveId("unrelated")).toBeUndefined();
      const id = plugin.resolveId("virtual:blume/consent-client");
      expect(plugin.load("unrelated")).toBeUndefined();
      const source = plugin.load(id);
      expect(source).toContain("...extension");
      expect(source).toContain("extension.scripts ?? []");
      expect(source.includes("blume/scripts/vercel-analytics")).toBe(
        command === "build"
      );
      expect(source).toContain(
        consent.kind === "c15t"
          ? "/site with spaces/consent.client.ts"
          : "const extension = {}"
      );
      expect(injectScript.mock.calls[0]?.[0]).toBe("page");
      expect(injectScript.mock.calls[0]?.[1]).toContain("startConsentRuntime");
    }
  }
});

it("preserves Vercel's debug loader and custom script URL", () => {
  expect(analyticsClientModule([vercel({ debug: true })])).not.toContain(
    '"scriptUrl"'
  );
  expect(
    analyticsClientModule([vercel({ mode: "development" })])
  ).not.toContain('"scriptUrl"');
  expect(
    analyticsClientModule([
      vercel({ scriptSrc: "https://proxy.example.com/insights.js" }),
    ])
  ).toContain('"scriptUrl":"https://proxy.example.com/insights.js"');
});

it.each([
  { command: "build", legacy: true },
  { command: "build", legacy: false },
  { command: "dev", legacy: true },
] as const)(
  "preserves client scripts, callbacks and pageview ownership during migration: %j",
  async ({ command, legacy }) => {
    const root = await mkdtemp(path.join(tmpdir(), "blume-sdk-migration-"));
    try {
      await writeFile(
        path.join(root, "consent.client.mjs"),
        `import { segment } from ${JSON.stringify(new URL("../src/scripts/segment.ts", import.meta.url).href)};
export default { scripts: [segment({ writeKey: "seg" })], pageviews: ["segment"], callbacks: { onError: () => "preserved" } };`
      );
      const integration = blumeConsentIntegrations({
        analytics: legacy ? [posthog({ key: "ph" })] : [],
        consent: c15t({ clientEntrypoint: "./consent.client.mjs" }),
        root,
      }).find((entry) => entry.name === "blume:consent");
      const updateConfig = mock();
      const injectScript = mock();
      // SAFETY: these are the only Astro setup fields consumed by this hook.
      await integration?.hooks["astro:config:setup"]?.({
        command,
        injectScript,
        updateConfig,
      } as never);
      const plugin = updateConfig.mock.calls[0]?.[0].vite.plugins[0];
      const source: string = plugin.load(
        plugin.resolveId("virtual:blume/consent-client")
      );
      const modulePath = path.join(root, "generated.mjs");
      await writeFile(
        modulePath,
        source.replaceAll(/"blume\/(?<entry>[^"\n]+)"/gu, (_, entry: string) =>
          JSON.stringify(new URL(`../src/${entry}.ts`, import.meta.url).href)
        )
      );
      // SAFETY: evaluate our generated browser module against the actual SDK.
      const { default: client } = (await import(modulePath)) as {
        default: ConsentClientOptions;
      };
      expect(client.scripts?.map((entry) => entry.vendor)).toEqual(
        legacy && command === "build" ? ["posthog", "segment"] : ["segment"]
      );
      expect(client.pageviews).toEqual(
        legacy && command === "build" ? ["posthog", "segment"] : ["segment"]
      );
      expect(client.callbacks?.onError).toEqual(expect.any(Function));
      expect(injectScript.mock.calls[0]?.[1]).toContain(
        "startConsentRuntime(extension.scripts, extension.pageviews)"
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
);
