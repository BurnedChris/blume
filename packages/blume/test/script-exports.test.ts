import { expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

it("generates added exports, removes stale ones, and detects drift without changing files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "blume-exports-"));
  const packageRoot = path.join(root, "packages/blume");
  const sdkRoot = path.join(packageRoot, "node_modules/@c15t/scripts");
  const manifestPath = path.join(packageRoot, "package.json");
  const entry = path.resolve(
    import.meta.dirname,
    "../../../scripts/sync-c15t-scripts.ts"
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
        name: "@c15t/scripts",
      })
    );
    const original = JSON.stringify({
      exports: { ".": "./index.js", "./scripts/removed": "./old.js" },
      name: "blume",
    });
    await writeFile(manifestPath, original);
    await mkdir(path.join(packageRoot, "src/scripts"), { recursive: true });
    await writeFile(path.join(packageRoot, "src/scripts/removed.ts"), "old\n");
    await expect(run(true)).resolves.toMatchObject({ code: 1 });
    expect(await readFile(manifestPath, "utf-8")).toBe(original);
    expect(
      await readFile(path.join(packageRoot, "src/scripts/removed.ts"), "utf-8")
    ).toBe("old\n");
    await expect(run()).resolves.toMatchObject({ code: 0 });
    const generated = JSON.parse(await readFile(manifestPath, "utf-8"));
    expect(Object.keys(generated.exports)).toEqual([
      ".",
      "./scripts/nested/vendor",
      "./scripts/new-vendor",
      "./scripts/registry",
    ]);
    expect(Object.keys(generated.exports["./scripts/new-vendor"])).toEqual([
      "types",
      "default",
    ]);
    expect(generated.exports["./scripts/new-vendor"]).toEqual({
      default: "./src/scripts/new-vendor.ts",
      types: "./dist/types/scripts/new-vendor.d.ts",
    });
    expect(
      await Bun.file(path.join(packageRoot, "src/scripts/removed.ts")).exists()
    ).toBe(false);
    expect(
      await readFile(
        path.join(packageRoot, "src/scripts/new-vendor.ts"),
        "utf-8"
      )
    ).toContain('export * from "@c15t/scripts/new-vendor";');
    await expect(run(true)).resolves.toMatchObject({ code: 0 });
    await writeFile(
      path.join(packageRoot, "src/scripts/new-vendor.ts"),
      "edited\n"
    );
    expect(await run(true)).toEqual({
      code: 1,
      stderr: expect.stringContaining("bun run sync:c15t-scripts"),
    });
    expect(
      await readFile(
        path.join(packageRoot, "src/scripts/new-vendor.ts"),
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
      'export const builtInScriptIntegrations = [{ label: "New Vendor", packageSubpath: "new-vendor", consentCategory: "measurement" }];'
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
      "| New Vendor | `blume/scripts/new-vendor` | `measurement` |"
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
