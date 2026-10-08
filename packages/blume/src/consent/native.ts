import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** Options for {@link native}. */
export interface NativeOptions {
  /** Where the banner's privacy policy link goes: a page route or a URL. */
  policy?: string;
}

export const nativeOptionsSchema = z.strictObject({
  policy: z.string().min(1).optional(),
});

export type NativeAdapter = AdapterDescriptor<"native", NativeOptions>;

export const nativeAdapterSchema = adapterDescriptorSchema(
  "native",
  nativeOptionsSchema
);

/** Backward-compatible alias for c15t's offline banner and preferences dialog.
 * Choices stay in the browser. Use c15t() for backend and translation options.
 */
export const native = (options: NativeOptions = {}): NativeAdapter => ({
  kind: "native",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
