import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  consentAdapterDependencies,
  missingRuntimeDependencies,
} from "../src/astro/runtime-deps.ts";
import {
  astroConfigTemplate,
  projectNeedsReact,
} from "../src/astro/templates.ts";
import {
  blumeC15t,
  c15tAstroOptions,
  c15tClientEntrypoint,
} from "../src/consent/c15t-integration.ts";
import { c15t, native } from "../src/consent/index.ts";
import type { ConsentAdapter } from "../src/consent/schema.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import type { ProjectContext } from "../src/core/types.ts";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "blume-c15t-"));
  await mkdir(path.join(root, "node_modules"));
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

describe("c15t()", () => {
  it("returns a descriptor that declares c15t's Astro packages", () => {
    expect(c15t()).toStrictEqual({
      kind: "c15t",
      options: {},
      requiredSecrets: [],
      runtimeDeps: ["@c15t/astro", "@c15t/react"],
    });
    expect(c15t({ backendURL: "https://consent.example.com" }).options).toEqual(
      { backendURL: "https://consent.example.com" }
    );
  });

  it("validates as blume.config consent, passing c15t's options through", () => {
    const consent = c15t({
      legalLinks: { privacyPolicy: { href: "/privacy" } },
      scripts: [
        { category: "measurement", id: "plain", src: "https://x.dev/a.js" },
      ],
    });
    expect(blumeConfigSchema.parse({ consent }).consent).toStrictEqual(consent);
  });

  it("sends callbacks to c15t.client.ts, with the option that holds one", () => {
    const consent = c15t({
      scripts: [{ category: "measurement", id: "cb", onLoad: () => null }],
    });
    const result = blumeConfigSchema.safeParse({ consent });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("c15t.client.ts");
    expect(result.error?.issues[0]?.path).toStrictEqual([
      "consent",
      "options",
      "scripts",
    ]);
  });
});

describe("c15tClientEntrypoint", () => {
  it("resolves a configured entrypoint from the Blume project", () => {
    expect(
      c15tClientEntrypoint({ clientEntrypoint: "./consent/client.ts" }, root)
    ).toBe(path.join(root, "consent/client.ts"));
  });

  it("finds c15t.client.* next to blume.config.ts, or none", async () => {
    expect(c15tClientEntrypoint({}, root)).toBeUndefined();
    await writeFile(path.join(root, "c15t.client.js"), "export default {};");
    expect(c15tClientEntrypoint({}, root)).toBe(
      path.join(root, "c15t.client.js")
    );
    await writeFile(path.join(root, "c15t.client.ts"), "export default {};");
    expect(c15tClientEntrypoint({}, root)).toBe(
      path.join(root, "c15t.client.ts")
    );
  });
});

describe("c15tAstroOptions", () => {
  it("works offline, asking everywhere, with no backend in sight", () => {
    const options = c15tAstroOptions({}, root, {});
    expect(options.mode).toEqual({
      policyRules: [
        {
          id: "blume-global-opt-in",
          match: { fallback: true, isDefault: true },
          model: "opt-in",
          prompt: "choice",
        },
      ],
      type: "offline",
    });
  });

  it("leaves the mode to c15t once a backend is configured", () => {
    expect(
      c15tAstroOptions({ backendURL: "https://c.example.com" }, root, {}).mode
    ).toBeUndefined();
    expect(
      c15tAstroOptions({}, root, {
        PUBLIC_C15T_BACKEND_URL: "https://c.example.com",
      }).mode
    ).toBeUndefined();
    expect(
      c15tAstroOptions({ mode: { type: "hosted" } }, root, {}).mode
    ).toEqual({ type: "hosted" });
  });

  it("keeps Blume's theme, UI, and equal-weight actions under the site's own", () => {
    const options = c15tAstroOptions(
      {
        presentation: { prompt: { primaryActions: ["accept"] } },
        theme: { colors: { primary: "red" } },
      },
      root,
      {}
    );
    expect(options.colorScheme).toBe("none");
    expect(options.ui).toBe("react");
    expect(options.clientEntrypoint).toBeUndefined();
    expect(options.presentation?.prompt?.primaryActions).toEqual(["accept"]);
    expect(options.theme?.colors?.primary).toBe("red");
    expect(options.theme?.colors?.surface).toBe("var(--blume-background)");
    expect(
      c15tAstroOptions({}, root, {}).presentation?.prompt?.primaryActions
    ).toEqual([]);
  });
});

describe("blumeC15t", () => {
  it("adds Blume's stylesheet ahead of c15t's own integration", () => {
    const [styles, integration] = blumeC15t({ options: {}, root });
    expect(styles?.name).toBe("blume:c15t-styles");
    expect(integration?.name).toContain("c15t");
    const injected: [string, string][] = [];
    // SAFETY: Blume's styles hook reads only `injectScript`, which is all the
    // stand-in setup options carry.
    const setup = styles?.hooks["astro:config:setup"] as (options: {
      injectScript: (stage: string, content: string) => void;
    }) => void;
    setup({
      injectScript: (stage, content) => injected.push([stage, content]),
    });
    expect(injected).toEqual([
      ["page-ssr", 'import "blume/consent/c15t.css";'],
    ]);
  });
});

describe("projectNeedsReact", () => {
  const none = {
    assistantEnabled: false,
    consent: null,
    detectedReact: false,
    frameworks: new Set<string>(),
  };

  it("turns React on for c15t's dialog and not for other consent", () => {
    expect(projectNeedsReact(none)).toBe(false);
    expect(projectNeedsReact({ ...none, consent: native() })).toBe(false);
    expect(projectNeedsReact({ ...none, consent: c15t() })).toBe(true);
    expect(projectNeedsReact({ ...none, frameworks: new Set(["react"]) })).toBe(
      true
    );
  });
});

const context = (): ProjectContext => ({
  componentsFile: null,
  configFile: null,
  contentRoot: "/p/content",
  distDir: "/p/dist",
  outDir: "/p/.blume",
  pagesRoot: null,
  root: "/p",
  themeFile: null,
});

const renderConfig = (
  consent: ConsentAdapter | undefined,
  generatedModulesDir?: string
) =>
  astroConfigTemplate({
    askPath: "/p/.blume/src/generated/Ask.astro",
    config: blumeConfigSchema.parse({ consent }),
    consentClientPath: "/p/.blume/src/generated/consent-client.ts",
    contentRoutes: [],
    context: context(),
    examplesPath: "/p/.blume/src/generated/examples.ts",
    examplesThemePath: "/p/.blume/src/generated/examples.css",
    featuresPath: "/p/.blume/src/generated/features.ts",
    generatedModulesDir,
    needsReact: true,
    pages: [],
    searchClientPath: "/p/.blume/src/generated/search-client.ts",
    themePath: "/p/.blume/src/generated/app.css",
  });

describe("astroConfigTemplate with consent", () => {
  it("mounts c15t's integration and components only for c15t()", () => {
    const out = renderConfig(c15t({ backendURL: "https://c.example.com" }));
    expect(out).toContain(
      'import { blumeC15t } from "blume/consent/c15t-integration";'
    );
    expect(out).toContain(
      '...blumeC15t({ options: {"backendURL":"https://c.example.com"}, root: "/p" })'
    );
    expect(out).toContain(
      '"blume:c15t-banner": "blume/components/layout/C15tBanner.astro"'
    );
    expect(out).toContain(
      '"blume:c15t-head": "blume/components/layout/C15tHead.astro"'
    );
  });

  it("points other sites' c15t aliases at an empty component", () => {
    for (const consent of [undefined, native()]) {
      const out = renderConfig(consent);
      expect(out).not.toContain("blumeC15t");
      expect(out).toContain(
        '"blume:c15t-banner": "blume/components/layout/NoConsent.astro"'
      );
      expect(out).toContain(
        '"blume:c15t-head": "blume/components/layout/NoConsent.astro"'
      );
    }
  });

  it("resolves an ejected app's root from its config file", () => {
    expect(renderConfig(c15t(), "./src/generated")).toContain(
      'root: fileURLToPath(new URL(".", import.meta.url))'
    );
  });
});

describe("consentAdapterDependencies", () => {
  it("reports c15t's packages when they aren't installed anywhere", () => {
    const { consent } = blumeConfigSchema.parse({ consent: c15t() });
    const missing = [
      {
        dep: "@c15t/astro",
        install: ["@c15t/astro"],
        owner: 'Consent adapter "c15t"',
      },
      {
        dep: "@c15t/react",
        install: ["@c15t/react"],
        owner: 'Consent adapter "c15t"',
      },
    ];
    expect(consentAdapterDependencies(consent, root, root)).toEqual(missing);
    expect(
      missingRuntimeDependencies(
        blumeConfigSchema.parse({ consent: c15t() }),
        root,
        [],
        root
      ).filter(({ owner }) => owner.startsWith("Consent"))
    ).toEqual(missing);
  });

  it("needs nothing without consent or for an adapter with no packages", () => {
    expect(consentAdapterDependencies(null, root, root)).toEqual([]);
    expect(consentAdapterDependencies(native(), root, root)).toEqual([]);
  });
});
