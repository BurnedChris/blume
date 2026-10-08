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
import { defineConsent } from "../src/consent/client.ts";
import {
  c15t,
  ethyca,
  hosted,
  manifest,
  native,
  offline,
  osano,
} from "../src/consent/index.ts";
import type { ConsentClientOptions } from "../src/consent/index.ts";
import { blumeConsentIntegrations } from "../src/consent/integration.ts";
import { findConsentFile, resolveProjectContext } from "../src/core/project.ts";
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
it("takes c15t v3's mode factories as the serializable mode", () => {
  for (const mode of [
    hosted({ url: "https://consent.example.com" }),
    manifest({ backendURL: "https://consent.example.com" }),
    offline(),
  ]) {
    expect(
      blumeConfigSchema.parse({ consent: c15t({ mode }) }).consent?.options
    ).toEqual({ mode });
  }
  expect(c15t().options.mode).toEqual(offline());
});

it("finds consent.ts at the project root and types it with defineConsent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "blume-consent-file-"));
  try {
    const config = blumeConfigSchema.parse({});
    expect(findConsentFile(root)).toBeNull();
    expect(resolveProjectContext(root, config).consentFile).toBeNull();
    await writeFile(path.join(root, "consent.ts"), "export default {};");
    expect(resolveProjectContext(root, config).consentFile).toBe(
      path.join(root, "consent.ts")
    );
    const options = { pageviews: ["segment" as const], scripts: [] };
    expect(defineConsent(options)).toBe(options);
  } finally {
    await rm(root, { force: true, recursive: true });
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
  expect(source).toContain('from "blume/integrations/google-tag-manager"');
  expect(source).toContain('"dataLayer":"customLayer"');
  expect(source).toContain('"apiHost":"https://us.i.posthog.com"');
  expect(source).toContain('"textContent":"window.custom = true"');
  expect(source).toContain('export const pageviews = ["segment"]');
  expect(
    source.match(/from "blume\/integrations\/vercel-analytics"/gu)
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
    /"blume\/integrations\/(?<subpath>[^"\n]+)"/gu,
    (_, name: string) =>
      JSON.stringify(
        new URL(`../src/integrations/${name}.ts`, import.meta.url).href
      )
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

it("declares Tailwind's layer order ahead of c15t's stylesheet", async () => {
  const integrations = blumeConsentIntegrations({
    analytics: [],
    consent: c15t(),
    root: "/site",
  });
  // c15t injects its `@layer components` CSS as a page-ssr import; cascade
  // layers rank by first mention, so the order statement must land first.
  expect(integrations.map((entry) => entry.name)).toEqual([
    "blume:consent-styles",
    "@c15t/astro",
    "blume:consent",
  ]);
  const injectScript = mock();
  // SAFETY: this hook consumes only injectScript.
  await integrations[0]?.hooks["astro:config:setup"]?.({
    injectScript,
  } as never);
  expect(injectScript.mock.calls).toEqual([
    ["page-ssr", 'import "blume/consent/c15t.css";'],
  ]);
});

/** Run c15t's and Blume's setup hooks and read what c15t serialized. */
const setupConsent = async (consent: ReturnType<typeof c15t>) => {
  const integrations = blumeConsentIntegrations({
    analytics: [],
    consent,
    root: "/site",
  });
  const updateConfig = mock();
  const injectScript = mock();
  for (const name of ["@c15t/astro", "blume:consent"]) {
    // SAFETY: c15t's setup and Blume's consume only these Astro fields.
    // oxlint-disable-next-line no-await-in-loop -- Order matters: c15t, then Blume.
    await integrations
      .find((entry) => entry.name === name)
      ?.hooks["astro:config:setup"]?.({
        addMiddleware: mock(),
        command: "build",
        injectRoute: mock(),
        injectScript,
        updateConfig,
      } as never);
  }
  const plugin = updateConfig.mock.calls
    .flatMap(([config]) => config.vite.plugins)
    .find((entry) => entry.name === "c15t:options");
  const read = (ssr: boolean) =>
    JSON.parse(
      plugin
        .load("\0virtual:c15t/options", { ssr })
        .replace(/^export default /u, "")
        .slice(0, -1)
    );
  return {
    options: read(false),
    serverOptions: read(true),
    styles: injectScript.mock.calls
      .filter(([stage]) => stage === "page-ssr")
      .map(([, source]) => source),
  };
};

it("styles c15t from Blume's theme tokens and leaves dark mode to the site", async () => {
  // SAFETY: colorScheme is outside C15tOptions; this checks a JS config's value is overridden.
  const defaults = await setupConsent(c15t({ colorScheme: "dark" } as never));
  expect(defaults.options.colorScheme).toBe("light");
  // No accent-colored action outranks the equal Reject/Accept pair.
  expect(defaults.options.presentation.prompt.primaryActions).toEqual([]);
  expect(defaults.options.theme).toMatchObject({
    colors: {
      primary: "var(--blume-action)",
      surface: "var(--blume-background)",
      text: "var(--blume-foreground)",
    },
    dark: { overlay: "oklch(0 0 0 / 0.7)" },
    radius: { lg: "var(--blume-radius)" },
    typography: { fontFamily: "var(--blume-font-body)" },
  });
  // c15t's stylesheet, then the dialog's, which Astro 7 drops from the island.
  expect(defaults.styles).toEqual([
    expect.stringContaining("@c15t/astro/dist/styles.css"),
    expect.stringContaining("@c15t/ui/dist/styles/dialog.css"),
  ]);

  const custom = await setupConsent(
    c15t({
      presentation: { prompt: { primaryActions: ["accept"] } },
      styles: false,
      theme: {
        colors: { primary: "red" },
        slots: { consentBannerCard: "shadow-none" },
        typography: { fontFamily: "Inter" },
      },
    })
  );
  expect(custom.options.presentation.prompt.primaryActions).toEqual(["accept"]);
  // The site's tokens win one at a time; Blume's fill the rest.
  expect(custom.options.theme.colors.primary).toBe("red");
  expect(custom.options.theme.colors.surface).toBe("var(--blume-background)");
  expect(custom.options.theme.typography).toEqual({ fontFamily: "Inter" });
  expect(custom.options.theme.slots).toEqual({
    consentBannerCard: "shadow-none",
  });
  expect(custom.styles).toEqual([]);
});

it("bundles the manifest at build time in manifest mode unless the site opts out", async () => {
  const policy = { branding: "inth", revision: "r1", schemaVersion: 2 };
  const fetchMock = mock((_url: string | URL | Request) =>
    Promise.resolve(Response.json(policy))
  );
  const realFetch = globalThis.fetch;
  // SAFETY: c15t's build-time loader only calls fetch(url, init).
  globalThis.fetch = fetchMock as never;
  try {
    const mode = manifest({ backendURL: "https://consent.example.com" });
    const built = await setupConsent(c15t({ mode }));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://consent.example.com/manifest",
    ]);
    // The server gets the snapshot; the browser bundle never does.
    expect(built.serverOptions.mode.manifest).toMatchObject(policy);
    expect(built.options.mode.manifest).toBeUndefined();

    fetchMock.mockClear();
    await setupConsent(c15t({ buildManifest: false, mode }));
    await setupConsent(c15t({ mode: hosted({ url: "https://c.example" }) }));
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    globalThis.fetch = realFetch;
  }
});

it("wires the Astro client module, preserves callbacks, and suppresses legacy trackers in dev", async () => {
  // A root `consent.ts` is found by name; a site without one gets none.
  const withFile = await mkdtemp(path.join(tmpdir(), "blume-consent wire-"));
  const withoutFile = await mkdtemp(path.join(tmpdir(), "blume-consent-none-"));
  await writeFile(path.join(withFile, "consent.ts"), "export default {};");
  for (const command of ["build", "dev"] as const) {
    for (const [consent, root] of [
      [c15t(), withFile],
      [native({ policy: "/privacy" }), withoutFile],
      [native({ policy: "https://example.com/privacy" }), withoutFile],
    ] as const) {
      const integration = blumeConsentIntegrations({
        analytics: [vercel()],
        basePath: "/docs",
        consent,
        root,
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
      expect(source.includes("blume/integrations/vercel-analytics")).toBe(
        command === "build"
      );
      expect(source).toContain(
        root === withFile
          ? `import extension from ${JSON.stringify(path.join(withFile, "consent.ts"))};`
          : "const extension = {}"
      );
      const [styles, page] = injectScript.mock.calls;
      expect(styles?.[0]).toBe("page-ssr");
      expect(styles?.[1]).toMatch(
        /^import ".+\/@c15t\/ui\/dist\/styles\/dialog\.css";$/u
      );
      expect(page?.[0]).toBe("page");
      expect(page?.[1]).toContain("startConsentRuntime");
    }
  }
  await rm(withFile, { force: true, recursive: true });
  await rm(withoutFile, { force: true, recursive: true });
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
        path.join(root, "consent.mjs"),
        `import { segment } from ${JSON.stringify(new URL("../src/integrations/segment.ts", import.meta.url).href)};
export default { scripts: [segment({ writeKey: "seg" })], pageviews: ["segment"], callbacks: { onError: () => "preserved" } };`
      );
      const integration = blumeConsentIntegrations({
        analytics: legacy ? [posthog({ key: "ph" })] : [],
        consent: c15t(),
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
      expect(injectScript.mock.calls.at(-1)?.[1]).toContain(
        "startConsentRuntime(extension.scripts, extension.pageviews)"
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
);
