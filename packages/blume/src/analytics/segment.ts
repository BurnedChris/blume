import { z } from "zod";

import type { AdapterDescriptor, JsonValue } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** Segment's CDN, where `segment()` loads analytics.js from when `cdn` is unset. */
export const SEGMENT_DEFAULT_CDN = "https://cdn.segment.com";

/** The options {@link segment} maps itself. */
export interface SegmentNamedOptions {
  /**
   * Origin of a custom domain that proxies Segment's CDN, e.g.
   * `https://cdn.example.com`. Defaults to Segment's own.
   */
  cdn?: string;
  /** Write key of the JavaScript source. */
  key: string;
}

/**
 * Options for {@link segment}: the named options plus any other
 * `analytics.load` option, forwarded verbatim (`integrations`, …). JSON
 * values only.
 */
export type SegmentOptions = SegmentNamedOptions & {
  [option: string]: JsonValue;
};

export const segmentOptionsSchema = z
  .object({
    cdn: z.string().min(1).optional(),
    key: z.string().min(1),
  })
  .catchall(z.json());

export type SegmentAdapter = AdapterDescriptor<"segment", SegmentOptions>;

export const segmentAdapterSchema = adapterDescriptorSchema(
  "segment",
  segmentOptionsSchema
);

/**
 * Segment (Twilio Segment) analytics.js. The write key is meant for the
 * browser — it identifies the source the SDK reports to.
 *
 * @deprecated Use blume/integrations/* in a consent client entrypoint. Removed in the next major release.
 */
export const segment = (options: SegmentOptions): SegmentAdapter => ({
  kind: "segment",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
