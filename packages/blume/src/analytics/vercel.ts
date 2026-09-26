import { z } from "zod";

import type { AdapterDescriptor, JsonValue } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The c15t Vercel SDK options that {@link vercel} documents. */
export interface VercelNamedOptions {
  /** Log every event to the console. Defaults to the component's own rule (on outside production). */
  debug?: boolean;
  /** Force the script's environment instead of letting it detect one. */
  mode?: "auto" | "development" | "production";
}

/**
 * Options for {@link vercel}. Supported c15t SDK settings include mode, debug,
 * endpoint, dsn and disableAutoTrack. scriptSrc aliases the SDK's scriptUrl.
 * Use a clientEntrypoint for callbacks and advanced script options.
 */
export type VercelOptions = VercelNamedOptions & {
  [option: string]: JsonValue;
};

export const vercelOptionsSchema = z
  .object({
    debug: z.boolean().optional(),
    mode: z.enum(["auto", "development", "production"]).optional(),
  })
  .catchall(z.json());

export type VercelAdapter = AdapterDescriptor<"vercel", VercelOptions>;

export const vercelAdapterSchema = adapterDescriptorSchema(
  "vercel",
  vercelOptionsSchema
);

/**
 * Vercel Web Analytics through c15t, using the first-party tracker by default.
 * Enable Web Analytics for the Vercel project before deploying.
 *
 * @deprecated Use blume/integrations/* in a consent client entrypoint. Removed in the next major release.
 */
export const vercel = (options: VercelOptions = {}): VercelAdapter => ({
  kind: "vercel",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
