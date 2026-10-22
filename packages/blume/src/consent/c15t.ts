import type { C15tAstroOptions } from "@c15t/astro";
import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/**
 * Options for {@link c15t}: c15t's own Astro integration options, passed
 * through. Blume picks the dialog's UI framework and drives its light/dark
 * class from the site's theme, so `ui`, `requireUIIntegration`, and
 * `colorScheme` are Blume's.
 */
export type C15tOptions = Omit<
  C15tAstroOptions,
  "ui" | "requireUIIntegration" | "colorScheme"
>;

// c15t owns its option vocabulary, so this checks only what the data
// snapshot needs: plain JSON, with a path to anything that isn't. Callbacks
// and `@c15t/integrations` helpers go in `c15t.client.ts`.
export const c15tOptionsSchema = z
  .custom<C15tOptions>()
  .superRefine((value, ctx) => {
    const result = z.record(z.string(), z.json()).safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: "custom",
          message:
            "c15t options must be JSON. Put callbacks and @c15t/integrations helpers in c15t.client.ts.",
          path: issue.path,
        });
      }
    }
  });

export type C15tAdapter = AdapterDescriptor<"c15t", C15tOptions>;

export const c15tAdapterSchema = adapterDescriptorSchema(
  "c15t",
  c15tOptionsSchema
);

/**
 * c15t's banner and preferences dialog, run by c15t's own Astro
 * integration. Blume's analytics run once the reader allows c15t's
 * `measurement` category, and the footer's Cookie settings link opens
 * c15t's dialog. Without a `mode` or `backendURL` the banner works offline,
 * keeping choices in the reader's browser. Scripts load the way c15t loads
 * them: plain ones in `scripts` here, and `@c15t/integrations` helpers in
 * a `c15t.client.ts` next to `blume.config.ts`.
 */
export const c15t = (options: C15tOptions = {}): C15tAdapter => ({
  kind: "c15t",
  options,
  requiredSecrets: [],
  runtimeDeps: ["@c15t/astro", "@c15t/react"],
});
