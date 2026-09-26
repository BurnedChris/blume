import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** Options for {@link clearbit}. */
export interface ClearbitOptions {
  /** Publishable API key (`pk_…`). */
  key: string;
}

export const clearbitOptionsSchema = z.strictObject({
  key: z.string().min(1),
});

export type ClearbitAdapter = AdapterDescriptor<"clearbit", ClearbitOptions>;

export const clearbitAdapterSchema = adapterDescriptorSchema(
  "clearbit",
  clearbitOptionsSchema
);

/**
 * Clearbit's website tag (Reveal and the Clearbit tags it manages). The
 * publishable key is meant for the browser.
 */
export const clearbit = (options: ClearbitOptions): ClearbitAdapter => ({
  kind: "clearbit",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
