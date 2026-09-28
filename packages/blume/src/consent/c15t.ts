import type { C15tAstroOptions } from "@c15t/astro";
import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/**
 * Serializable c15t Astro options. Scripts and callbacks go in `consent.ts`,
 * which Blume finds on its own; the banner follows the site's light/dark
 * theme, so `colorScheme` is Blume's too.
 */
export type C15tOptions = Omit<
  C15tAstroOptions,
  "scripts" | "ui" | "requireUIIntegration" | "colorScheme" | "clientEntrypoint"
>;

export type { ConsentClientOptions } from "./client.ts";

// c15t owns its option vocabulary. Validate JSON at the snapshot boundary,
// rather than copying its schema and drifting whenever the SDK adds an option.
export const c15tOptionsSchema = z
  .custom<C15tOptions>()
  .superRefine((value, ctx) => {
    const result = z.record(z.string(), z.json()).safeParse(value);
    if (!result.success) {
      ctx.addIssue({
        code: "custom",
        message:
          "c15t options must be JSON. Put callbacks and scripts in consent.ts.",
      });
    }
  });
export const c15tAdapterSchema = adapterDescriptorSchema(
  "c15t",
  c15tOptionsSchema
);
export type C15tAdapter = AdapterDescriptor<"c15t", C15tOptions>;

/** Use c15t's offline banner by default, or connect a hosted/self-hosted backend. */
export const c15t = (options: Partial<C15tOptions> = {}): C15tAdapter => ({
  kind: "c15t",
  options: { ...options, mode: options.mode ?? { type: "offline" } },
  requiredSecrets: [],
  runtimeDeps: ["@c15t/astro", "@c15t/core", "@c15t/react", "@c15t/scripts"],
});
