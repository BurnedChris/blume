import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** Options for {@link clarity}. */
export interface ClarityOptions {
  /** Project ID, from the project's tracking code in the Clarity dashboard. */
  id: string;
}

export const clarityOptionsSchema = z.strictObject({
  id: z.string().min(1),
});

export type ClarityAdapter = AdapterDescriptor<"clarity", ClarityOptions>;

export const clarityAdapterSchema = adapterDescriptorSchema(
  "clarity",
  clarityOptionsSchema
);

/**
 * Microsoft Clarity session recordings and heatmaps. The project ID is public;
 * it only picks the project the tag reports to.
 *
 * @deprecated Use blume/scripts/* in a consent client entrypoint. Removed in the next major release.
 */
export const clarity = (options: ClarityOptions): ClarityAdapter => ({
  kind: "clarity",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
