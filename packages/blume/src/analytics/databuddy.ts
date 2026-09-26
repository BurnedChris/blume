import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The script Databuddy's install snippet loads. */
export const DATABUDDY_SCRIPT_SRC = "https://cdn.databuddy.cc/databuddy.js";

/** The options {@link databuddy} maps itself. */
export interface DatabuddyNamedOptions {
  /** Client ID, from the website's settings in the Databuddy dashboard. */
  clientId: string;
}

/**
 * Options for {@link databuddy}: the client ID plus any other tracker setting,
 * forwarded as a `data-` attribute on the tag (`"track-web-vitals"` →
 * `data-track-web-vitals`, `"track-errors"`, `"track-outgoing-links"`,
 * `"api-url"`, …).
 */
export type DatabuddyOptions = DatabuddyNamedOptions & {
  [setting: string]: string;
};

export const databuddyOptionsSchema = z
  .object({
    clientId: z.string().min(1),
  })
  .catchall(z.string());

export type DatabuddyAdapter = AdapterDescriptor<"databuddy", DatabuddyOptions>;

export const databuddyAdapterSchema = adapterDescriptorSchema(
  "databuddy",
  databuddyOptionsSchema
);

/**
 * Databuddy. The client ID is public — it's in the tag on every page.
 */
export const databuddy = (options: DatabuddyOptions): DatabuddyAdapter => ({
  kind: "databuddy",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
