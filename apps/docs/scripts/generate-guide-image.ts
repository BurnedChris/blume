// Generate a guide cover: a fixed style (a soft-focus gradient in cool tones
// only) wrapped around one composition line, sent to OpenAI's image API. The
// style keeps every cover in one family; the composition, which names the
// shape and the colors, is what makes each one different.
//
//   bun run generate-guide-image "Two broad color fields meeting…" --id migrate-from-mintlify -n 3
//
// Name colors in the composition by hex. These anchors sit at matched
// lightness (OKLCH L 0.66 / 0.80 / 0.90), so covers in different hues still
// read as one bright, airy set; cornflower is near the docs accent
// (theme.accent). Mid is the darkest a cover should go.
//
//   lime green     mid #75A33E  bright #A4CD79  pale #D1E7BD
//   emerald        mid #37AB6B  bright #7AD59C  pale #C0EACD
//   seafoam teal   mid #1BA995  bright #52D7C1  pale #B3ECDF
//   aqua cyan      mid #19A4B7  bright #47D2E8  pale #B0EAF4
//   sky azure      mid #259CDE  bright #78C7FD  pale #C1E3FC
//   cornflower     mid #6A8EE8  bright #A0BDFF  pale #D0DEFD
//   indigo         mid #8685E5  bright #B3B6FD  pale #D9DBFC
//   violet         mid #A07CDB  bright #C9ADFD  pale #E3D6FE
//   orchid purple  mid #B574C9  bright #DEA5F0  pale #EFD2F8
//
// Candidates land in apps/docs/.guide-images/ (gitignored), so rejects never
// ship. Adopt the one you pick with `--use`, which copies it to
// public/guides/<id>.webp and writes the 96px thumbnail the guide grids show
// (a 48px swatch at 2x) to public/guides/thumbs/<id>.webp; then set `image`
// on the guide in pages/_guides/guides.ts.
//
//   bun run generate-guide-image --id migrate-from-mintlify --use .guide-images/<file>.webp
//
// Reads OPENAI_API_KEY from the environment, which Bun loads from
// apps/docs/.env.local. `--dry-run` prints the prompt without calling the API.
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import sharp from "sharp";

import { guides } from "../pages/_guides/guides.ts";

const MODEL = "gpt-image-2.5-sunburst";
const SIZE = "1536x1024";
const OUT_DIR = ".guide-images";
const PUBLIC_DIR = "public/guides";
/** The grid's 48px swatch at 2x. */
const THUMB_SIZE = 96;

const STYLE = `Abstract soft-focus gradient artwork, photographed out of focus, with fine
film grain over the whole image. Smooth color fields that melt into each other,
no hard edges. Bright, airy, and luminous, like daylight through tinted glass:
mostly light and mid tones, softly saturated, calm and fresh. No dark areas,
no black, no heavy shadows, no vignette.

Cool tones only: greens, teals, cyans, blues, indigos, violets, and purples.
Use the colors the composition names, and the blends between them. No warm
colors: no red, orange, yellow, warm pink, beige, or brown. No text, letters,
logos, objects, geometric shapes, lines, bokeh circles, stars, or patterns.
Landscape, 3:2.`;

const USAGE = `Usage: bun run generate-guide-image "<composition>" [--id <guide-id>] [-n <count>] [--dry-run]
       bun run generate-guide-image --id <guide-id> --use <candidate.webp>`;

interface ImagesResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string };
}

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    count: { default: "1", short: "n", type: "string" },
    "dry-run": { default: false, type: "boolean" },
    id: { type: "string" },
    use: { type: "string" },
  },
});

const { id } = values;
if (id && !guides.some((guide) => guide.id === id)) {
  fail(
    `Unknown guide "${id}". Guides: ${guides.map((guide) => guide.id).join(", ")}.`
  );
}

// --use: adopt a candidate as the guide's cover and write its grid thumbnail.
// The script runs from apps/docs, so a path copied from the repo root works
// too.
if (values.use) {
  if (!id) {
    fail("--use needs --id <guide-id> to know which guide the cover is for.");
  }
  const source = values.use.replace(/^apps\/docs\//u, "");
  const cover = path.join(PUBLIC_DIR, `${id}.webp`);
  const thumb = path.join(PUBLIC_DIR, "thumbs", `${id}.webp`);
  await mkdir(path.dirname(thumb), { recursive: true });
  if (path.resolve(source) !== path.resolve(cover)) {
    await copyFile(source, cover);
  }
  await sharp(cover)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
    .webp({ quality: 80 })
    .toFile(thumb);
  console.log(`  apps/docs/${cover}\n  apps/docs/${thumb}`);
  console.log(
    `\nSet image: { src: "/guides/${id}.webp" } on the guide in pages/_guides/guides.ts.`
  );
  process.exit(0);
}

const composition = positionals.join(" ").trim();
if (!composition) {
  fail(USAGE);
}

const count = Number(values.count);
if (!Number.isInteger(count) || count < 1 || count > 10) {
  fail(`--count must be a whole number from 1 to 10, not "${values.count}".`);
}

const prompt = `${STYLE}\n\nComposition: ${composition}`;
// 2026-09-27T15:30:12.000Z → 20260927-153012, so candidates sort by time.
const stamp = new Date()
  .toISOString()
  .replaceAll(/[-:]/gu, "")
  .replace("T", "-")
  .slice(0, 15);
const base = `${id ?? "draft"}-${stamp}`;

if (values["dry-run"]) {
  console.log(prompt);
  console.log(`\nWould write ${count} image(s) to ${OUT_DIR}/${base}-N.webp`);
  process.exit(0);
}

const key = process.env.OPENAI_API_KEY;
if (!key) {
  fail("Set OPENAI_API_KEY in apps/docs/.env.local or your shell.");
}

console.log(`Generating ${count} image(s) with ${MODEL} at ${SIZE}…`);
const response = await fetch("https://api.openai.com/v1/images/generations", {
  body: JSON.stringify({
    model: MODEL,
    n: count,
    output_compression: 85,
    output_format: "webp",
    prompt,
    size: SIZE,
  }),
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  method: "POST",
});
// SAFETY: the Images API answers with JSON: `data` on success, `error` on failure.
const body = (await response.json()) as ImagesResponse;
if (!response.ok) {
  fail(
    `OpenAI ${response.status}: ${body.error?.message ?? response.statusText}`
  );
}

await mkdir(OUT_DIR, { recursive: true });
const images = (body.data ?? []).flatMap((image, index) =>
  image.b64_json
    ? [
        {
          data: Buffer.from(image.b64_json, "base64"),
          file: path.join(OUT_DIR, `${base}-${index + 1}.webp`),
        },
      ]
    : []
);
await Promise.all(images.map((image) => writeFile(image.file, image.data)));
const written = images.map((image) => image.file);

if (written.length === 0) {
  fail("The API returned no images.");
}
console.log(written.map((file) => `  apps/docs/${file}`).join("\n"));
if (id) {
  console.log(
    `\nTo use one: bun run generate-guide-image --id ${id} --use ${written[0]}`
  );
}
