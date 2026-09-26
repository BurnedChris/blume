import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** Options for {@link googleTagManager}. */
export interface GoogleTagManagerOptions {
  /** Name of the data layer global the container reads. Defaults to `dataLayer`. */
  dataLayer?: string;
  /** Container ID (`GTM-…`). */
  id: string;
}

export const googleTagManagerOptionsSchema = z.strictObject({
  dataLayer: z.string().min(1).optional(),
  id: z.string().min(1),
});

export type GoogleTagManagerAdapter = AdapterDescriptor<
  "google-tag-manager",
  GoogleTagManagerOptions
>;

export const googleTagManagerAdapterSchema = adapterDescriptorSchema(
  "google-tag-manager",
  googleTagManagerOptionsSchema
);

/**
 * Google Tag Manager. Blume loads the container; which tags fire, and on what,
 * is the container's configuration. The container ID is public.
 */
export const googleTagManager = (
  options: GoogleTagManagerOptions
): GoogleTagManagerAdapter => ({
  kind: "google-tag-manager",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
