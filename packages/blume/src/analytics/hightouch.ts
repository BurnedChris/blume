import { z } from "zod";

import type { AdapterDescriptor, JsonValue } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The events API host `hightouch()` uses when `host` is unset. */
export const HIGHTOUCH_DEFAULT_HOST = "us-east-1.hightouch-events.com";

/** The options {@link hightouch} maps itself. */
export interface HightouchNamedOptions {
  /** Events API host, without a scheme. Defaults to the US East region. */
  host?: string;
  /** Write key of the event source. */
  key: string;
}

/**
 * Options for {@link hightouch}: the named options plus any other
 * `htevents.load` option, forwarded verbatim. JSON values only.
 */
export type HightouchOptions = HightouchNamedOptions & {
  [option: string]: JsonValue;
};

export const hightouchOptionsSchema = z
  .object({
    host: z.string().min(1).optional(),
    key: z.string().min(1),
  })
  .catchall(z.json());

export type HightouchAdapter = AdapterDescriptor<"hightouch", HightouchOptions>;

export const hightouchAdapterSchema = adapterDescriptorSchema(
  "hightouch",
  hightouchOptionsSchema
);

/**
 * Hightouch Events. The write key is meant for the browser — it identifies
 * the event source the SDK reports to.
 *
 * @deprecated Use blume/integrations/* in a consent client entrypoint. Removed in the next major release.
 */
export const hightouch = (options: HightouchOptions): HightouchAdapter => ({
  kind: "hightouch",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
