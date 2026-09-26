import { z } from "zod";

import type { AdapterDescriptor, JsonValue } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The options {@link heap} maps itself. */
export interface HeapNamedOptions {
  /** App ID (the environment ID), from the project's install settings. */
  id: string;
}

/**
 * Options for {@link heap}: the app ID plus any other `heap.load` config
 * option, forwarded verbatim (`disableTextCapture`, `secureCookie`, …). JSON
 * values only.
 */
export type HeapOptions = HeapNamedOptions & {
  [option: string]: JsonValue;
};

export const heapOptionsSchema = z
  .object({
    id: z.string().min(1),
  })
  .catchall(z.json());

export type HeapAdapter = AdapterDescriptor<"heap", HeapOptions>;

export const heapAdapterSchema = adapterDescriptorSchema(
  "heap",
  heapOptionsSchema
);

/**
 * Heap autocapture analytics. The app ID is public — the tag carries it on
 * every page.
 *
 * @deprecated Use blume/integrations/* in a consent client entrypoint. Removed in the next major release.
 */
export const heap = (options: HeapOptions): HeapAdapter => ({
  kind: "heap",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
