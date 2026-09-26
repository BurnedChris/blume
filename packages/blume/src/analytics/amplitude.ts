import { z } from "zod";

import type { AdapterDescriptor, JsonValue } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The options {@link amplitude} maps itself. */
export interface AmplitudeNamedOptions {
  /** Project API key. */
  key: string;
}

/**
 * Options for {@link amplitude}: the key plus any other Browser SDK
 * `amplitude.init` option, forwarded verbatim (`serverZone`, `autocapture`,
 * `defaultTracking`, …). JSON values only.
 */
export type AmplitudeOptions = AmplitudeNamedOptions & {
  [option: string]: JsonValue;
};

export const amplitudeOptionsSchema = z
  .object({
    key: z.string().min(1),
  })
  .catchall(z.json());

export type AmplitudeAdapter = AdapterDescriptor<"amplitude", AmplitudeOptions>;

export const amplitudeAdapterSchema = adapterDescriptorSchema(
  "amplitude",
  amplitudeOptionsSchema
);

/**
 * Amplitude product analytics through the Browser SDK's script loader. The
 * project API key is public — it's what every browser event carries.
 *
 * @deprecated Use blume/scripts/* in a consent client entrypoint. Removed in the next major release.
 */
export const amplitude = (options: AmplitudeOptions): AmplitudeAdapter => ({
  kind: "amplitude",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
