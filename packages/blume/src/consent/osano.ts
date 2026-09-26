import { z } from "zod";

import type { HeadScript } from "../analytics/head.ts";
import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** Options for {@link osano}. */
export interface OsanoOptions {
  /** Browser module exporting c15t scripts and lifecycle callbacks. */
  clientEntrypoint?: string;
  /** c15t category to provider consent property/notice mapping. Unmapped categories stay denied. */
  categories?: Partial<
    Record<"measurement" | "marketing" | "experience" | "functionality", string>
  >;
  /** The configuration ID from the script tag Osano gives you. */
  configId: string;
  /** The customer ID from the script tag Osano gives you. */
  customerId: string;
}

export const osanoOptionsSchema = z.strictObject({
  categories: z
    .partialRecord(
      z.enum(["measurement", "marketing", "experience", "functionality"]),
      z.string().min(1)
    )
    .optional(),
  clientEntrypoint: z.string().min(1).optional(),
  configId: z.string().min(1),
  customerId: z.string().min(1),
});

export type OsanoAdapter = AdapterDescriptor<"osano", OsanoOptions>;

export const osanoAdapterSchema = adapterDescriptorSchema(
  "osano",
  osanoOptionsSchema
);

/**
 * Osano Cookie Consent. Osano shows its own banner and drawer, set up in the
 * Osano dashboard, and Blume runs the analytics once Osano reports the
 * reader's `ANALYTICS` consent. Both IDs come from the script tag Osano
 * gives you, and neither is secret.
 */
export const osano = (options: OsanoOptions): OsanoAdapter => ({
  kind: "osano",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});

/**
 * Osano's synchronous bootstrap; c15t observes its decisions separately.
 * The IDs are path segments, so each is encoded.
 */
export const osanoHead = (options: OsanoOptions): HeadScript[] => [
  {
    attributes: {
      src: `https://cmp.osano.com/${encodeURIComponent(options.customerId)}/${encodeURIComponent(options.configId)}/osano.js`,
    },
    content: null,
  },
];
