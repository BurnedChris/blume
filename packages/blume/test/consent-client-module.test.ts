import { afterAll, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { consentClientTemplate } from "../src/astro/templates.ts";
import { CONSENT_CLIENT_MODULES } from "../src/consent/clients.ts";
import { native } from "../src/consent/native.ts";
import { osano } from "../src/consent/osano.ts";
import { eject } from "../src/registry/eject.ts";

/**
 * The consent adapter's browser module behind `blume:consent-client`: the
 * generated project imports only the configured adapter's module, with its
 * options baked in, and a no-op when there's none to start.
 */

describe(consentClientTemplate, () => {
  it("starts the configured adapter's module with its options", () => {
    const out = consentClientTemplate(native({ policy: "/privacy" }));
    expect(out).toContain(
      'import { start } from "blume/components/layout/consent/native.ts";'
    );
    expect(out).toContain('start(consent, {"policy":"/privacy"});');
    expect(out).toContain("export const startConsentClient = (");
  });

  it("is a no-op for a hosted manager, and without consent", () => {
    const hosted = consentClientTemplate(
      osano({ configId: "c", customerId: "u" })
    );
    expect(hosted).toContain(
      "export const startConsentClient = (): void => {};"
    );
    expect(hosted).not.toContain("import");
    expect(consentClientTemplate(null)).toBe(hosted);
  });

  it("points every registered module at a file the package ships", () => {
    for (const specifier of CONSENT_CLIENT_MODULES.values()) {
      const file = specifier.replace(/^blume\//u, "");
      expect(existsSync(new URL(`../src/${file}`, import.meta.url))).toBe(true);
    }
  });
});

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe("an ejected site", () => {
  it("writes the module and aliases it", async () => {
    const root = await mkdtemp(join(tmpdir(), "blume-eject-consent-"));
    roots.push(root);
    // The descriptor as JSON: a temp project can't import `blume/consent`.
    const files = {
      "blume.config.ts": `export default { consent: ${JSON.stringify(native())} };\n`,
      "docs/index.md": "---\ntitle: Home\n---\n# Home\n",
    };
    await Promise.all(
      Object.entries(files).map(async ([rel, content]) => {
        await mkdir(dirname(join(root, rel)), { recursive: true });
        await writeFile(join(root, rel), content, "utf-8");
      })
    );

    await eject(root);

    expect(
      readFileSync(join(root, "src/generated/consent-client.ts"), "utf-8")
    ).toBe(consentClientTemplate(native()));
    expect(readFileSync(join(root, "astro.config.mjs"), "utf-8")).toContain(
      '"blume:consent-client": fileURLToPath(new URL("./src/generated/consent-client.ts", import.meta.url)),'
    );
  });
});
