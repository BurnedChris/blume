import { z } from "zod";

import type { AdapterDescriptor, JsonValue } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** Mixpanel's data residency regions and the ingestion host each one uses. */
export const MIXPANEL_REGION_HOSTS = {
  eu: "https://api-eu.mixpanel.com",
  in: "https://api-in.mixpanel.com",
  us: "https://api.mixpanel.com",
} as const;

export type MixpanelRegion = keyof typeof MIXPANEL_REGION_HOSTS;

/** The options {@link mixpanel} maps itself. */
export interface MixpanelNamedOptions {
  /** Data residency region of the project. Defaults to US. */
  region?: MixpanelRegion;
  /** Project token. */
  token: string;
}

/**
 * Options for {@link mixpanel}: the named options plus any other
 * `mixpanel.init` option, forwarded verbatim (`persistence`, `autocapture`,
 * `record_sessions_percent`, `debug`, …). JSON values only.
 */
export type MixpanelOptions = MixpanelNamedOptions & {
  [option: string]: JsonValue;
};

export const mixpanelOptionsSchema = z
  .object({
    region: z.enum(["us", "eu", "in"]).optional(),
    token: z.string().min(1),
  })
  .catchall(z.json());

export type MixpanelAdapter = AdapterDescriptor<"mixpanel", MixpanelOptions>;

export const mixpanelAdapterSchema = adapterDescriptorSchema(
  "mixpanel",
  mixpanelOptionsSchema
);

/**
 * Mixpanel product analytics. The project token is public — it's what every
 * browser event carries.
 *
 * @deprecated Use blume/integrations/* in a consent client entrypoint. Removed in the next major release.
 */
export const mixpanel = (options: MixpanelOptions): MixpanelAdapter => ({
  kind: "mixpanel",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
