import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Temporary alpha-development setup. Build c15t first, then run:
// bun scripts/link-c15t.ts ../c15t-blume-runtime && bun install
const source = path.resolve(process.argv[2] ?? "../c15t-blume-runtime");
const root = path.resolve(import.meta.dirname, "..");
const names = [
  "astro",
  "core",
  "scripts",
  "react",
  "schema",
  "translations",
  "ui",
  "iab",
  "browser",
  "dev-tools",
  "svelte",
  "vue",
];
await Promise.all(
  names.map(async (name) => {
    const from = path.resolve(source, "packages", name);
    const to = path.resolve(root, ".c15t-local", name);
    const manifest = JSON.parse(
      await readFile(path.resolve(from, "package.json"), "utf-8")
    );
    // Prepared packages are temporary workspaces. Do not copy development
    // dependencies or install hooks into the consumer's dependency graph.
    delete manifest.devDependencies;
    delete manifest.scripts;
    await mkdir(to, { recursive: true });
    await Promise.all(
      (manifest.files ?? ["dist", "dist-types"]).map(async (entry: string) => {
        try {
          await cp(path.resolve(from, entry), path.resolve(to, entry), {
            recursive: true,
          });
        } catch (error) {
          if (
            !(
              error instanceof Error &&
              "code" in error &&
              error.code === "ENOENT"
            )
          ) {
            throw error;
          }
        }
      })
    );
    await writeFile(
      path.resolve(to, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
  })
);
console.log(
  "Prepared .c15t-local. Run bun install; these file dependencies are for alpha testing only."
);
