import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The script Fathom's dashboard snippet loads. */
export const FATHOM_SCRIPT_SRC = "https://cdn.usefathom.com/script.js";

/** The options {@link fathom} maps itself. */
export interface FathomNamedOptions {
  /** Site ID, from the site's script settings. */
  site: string;
}

/**
 * Options for {@link fathom}: the site ID plus any other script setting,
 * forwarded as a `data-` attribute on the tag (`spa` → `data-spa`,
 * `"honor-dnt"` → `data-honor-dnt`, `"excluded-domains"`, `canonical`, …).
 */
export type FathomOptions = FathomNamedOptions & {
  [setting: string]: string;
};

export const fathomOptionsSchema = z
  .object({
    site: z.string().min(1),
  })
  .catchall(z.string());

export type FathomAdapter = AdapterDescriptor<"fathom", FathomOptions>;

export const fathomAdapterSchema = adapterDescriptorSchema(
  "fathom",
  fathomOptionsSchema
);

/**
 * Fathom Analytics. The site ID is public — it's in the tag on every page.
 *
 * @deprecated Use blume/scripts/* in a consent client entrypoint. Removed in the next major release.
 */
export const fathom = (options: FathomOptions): FathomAdapter => ({
  kind: "fathom",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
