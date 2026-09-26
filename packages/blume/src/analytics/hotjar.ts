import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The tracking-code version (`hjsv`) `hotjar()` uses when `version` is unset. */
export const HOTJAR_DEFAULT_VERSION = 6;

/** Options for {@link hotjar}. */
export interface HotjarOptions {
  /** Site ID (`hjid`), from the site's tracking code. */
  id: number;
  /** Tracking-code version (`hjsv`). Defaults to the current one. */
  version?: number;
}

export const hotjarOptionsSchema = z.strictObject({
  id: z.number().int().positive(),
  version: z.number().int().positive().optional(),
});

export type HotjarAdapter = AdapterDescriptor<"hotjar", HotjarOptions>;

export const hotjarAdapterSchema = adapterDescriptorSchema(
  "hotjar",
  hotjarOptionsSchema
);

/**
 * Hotjar heatmaps and recordings. The site ID is public — it's in the tracking
 * code on every page.
 *
 * @deprecated Use blume/scripts/* in a consent client entrypoint. Removed in the next major release.
 */
export const hotjar = (options: HotjarOptions): HotjarAdapter => ({
  kind: "hotjar",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
