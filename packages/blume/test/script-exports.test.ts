import { expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

it("generates added exports, removes stale ones, and detects drift without changing files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "blume-exports-"));
  const packageRoot = path.join(root, "packages/blume");
  const sdkRoot = path.join(packageRoot, "node_modules/@c15t/integrations");
  const manifestPath = path.join(packageRoot, "package.json");
  const entry = path.resolve(
    import.meta.dirname,
    "../../../scripts/sync-c15t-integrations.ts"
  );
  const run = async (check = false) => {
    const child = Bun.spawn(
      [process.execPath, entry, "--root", root, ...(check ? ["--check"] : [])],
      { stderr: "pipe", stdout: "pipe" }
    );
    const [code, stderr] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
    ]);
    return { code, stderr };
  };
  try {
    await mkdir(sdkRoot, { recursive: true });
    await writeFile(path.join(sdkRoot, "registry.js"), "export {};\n");
    await writeFile(
      path.join(sdkRoot, "package.json"),
      JSON.stringify({
        exports: {
          "./*": "./*.js",
          "./nested/vendor": "./registry.js",
          "./new-vendor": "./registry.js",
          "./package.json": "./package.json",
          "./private": null,
          "./registry": "./registry.js",
        },
        name: "@c15t/integrations",
      })
    );
    const original = JSON.stringify({
      exports: { ".": "./index.js", "./integrations/removed": "./old.js" },
      name: "blume",
    });
    await writeFile(manifestPath, original);
    await mkdir(path.join(packageRoot, "src/integrations"), {
      recursive: true,
    });
    await writeFile(
      path.join(packageRoot, "src/integrations/removed.ts"),
      "old\n"
    );
    await expect(run(true)).resolves.toMatchObject({ code: 1 });
    expect(await readFile(manifestPath, "utf-8")).toBe(original);
    expect(
      await readFile(
        path.join(packageRoot, "src/integrations/removed.ts"),
        "utf-8"
      )
    ).toBe("old\n");
    await expect(run()).resolves.toMatchObject({ code: 0 });
    const generated = JSON.parse(await readFile(manifestPath, "utf-8"));
    expect(Object.keys(generated.exports)).toEqual([
      ".",
      "./integrations/nested/vendor",
      "./integrations/new-vendor",
      "./integrations/registry",
    ]);
    expect(Object.keys(generated.exports["./integrations/new-vendor"])).toEqual(
      ["types", "default"]
    );
    expect(generated.exports["./integrations/new-vendor"]).toEqual({
      default: "./src/integrations/new-vendor.ts",
      types: "./dist/types/integrations/new-vendor.d.ts",
    });
    expect(
      await Bun.file(
        path.join(packageRoot, "src/integrations/removed.ts")
      ).exists()
    ).toBe(false);
    expect(
      await readFile(
        path.join(packageRoot, "src/integrations/new-vendor.ts"),
        "utf-8"
      )
    ).toContain('export * from "@c15t/integrations/new-vendor";');
    await expect(run(true)).resolves.toMatchObject({ code: 0 });
    await writeFile(
      path.join(packageRoot, "src/integrations/new-vendor.ts"),
      "edited\n"
    );
    expect(await run(true)).toEqual({
      code: 1,
      stderr: expect.stringContaining("bun run sync:c15t-integrations"),
    });
    expect(
      await readFile(
        path.join(packageRoot, "src/integrations/new-vendor.ts"),
        "utf-8"
      )
    ).toBe("edited\n");
    await expect(run()).resolves.toMatchObject({ code: 0 });
    await expect(run(true)).resolves.toMatchObject({ code: 0 });

    const docsPath = path.join(
      root,
      "apps/docs/content/docs/configuration/integrations.mdx"
    );
    await mkdir(path.dirname(docsPath), { recursive: true });
    const draft =
      "Before\n{/* c15t-integrations:start */}\nStale table\n{/* c15t-integrations:end */}\nAfter\n";
    await writeFile(docsPath, draft);
    await writeFile(
      path.join(sdkRoot, "registry.js"),
      `export const builtInScriptIntegrations = [
        { label: "New Vendor", packageSubpath: "new-vendor", consentCategory: "measurement" },
        { label: "Either", packageSubpath: "new-vendor", consentCategory: { or: ["necessary", "measurement"] } },
        { label: "Nested", packageSubpath: "new-vendor", consentCategory: { and: ["marketing", { not: { or: ["experience", "functionality"] } }] } },
      ];`
    );
    await expect(run(true)).resolves.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("integration documentation catalog"),
    });
    expect(await readFile(docsPath, "utf-8")).toBe(draft);
    await expect(run()).resolves.toMatchObject({ code: 0 });
    const guide = await readFile(docsPath, "utf-8");
    expect(guide).toStartWith("Before\n");
    expect(guide).toEndWith("After\n");
    expect(guide).toContain(
      "| New Vendor | `blume/integrations/new-vendor` | `measurement` |"
    );
    expect(guide).toContain(
      "| Either | `blume/integrations/new-vendor` | `necessary` or `measurement` |"
    );
    expect(guide).toContain(
      "| Nested | `blume/integrations/new-vendor` | `marketing` and not (`experience` or `functionality`) |"
    );
    expect(guide).not.toContain("Stale table");
    await expect(run(true)).resolves.toMatchObject({ code: 0 });
    await writeFile(docsPath, "Missing markers");
    await expect(run()).resolves.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("missing its generated catalog markers"),
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
