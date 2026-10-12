import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** Options for {@link adobe}. */
export interface AdobeOptions {
  /**
   * The Launch (Adobe Experience Platform Tags) embed script URL for the
   * environment to load, e.g. `https://assets.adobedtm.com/…/launch-….min.js`.
   */
  url: string;
}

export const adobeOptionsSchema = z.strictObject({
  url: z.string().min(1),
});

export type AdobeAdapter = AdapterDescriptor<"adobe", AdobeOptions>;

export const adobeAdapterSchema = adapterDescriptorSchema(
  "adobe",
  adobeOptionsSchema
);

/**
 * Adobe Analytics through a Launch property: Blume loads the environment's
 * embed script, and the property's own rules decide what to track. Copy the
 * URL from the environment's install instructions in Data Collection.
 *
 * @deprecated Use blume/integrations/* in consent.ts. Removed in the next major release.
 */
export const adobe = (options: AdobeOptions): AdobeAdapter => ({
  kind: "adobe",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
