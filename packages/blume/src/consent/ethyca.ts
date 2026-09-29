import { z } from "zod";

import type { HeadScript } from "../analytics/head.ts";
import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** Options for {@link ethyca}. */
export interface EthycaOptions {
  /** c15t category to provider consent property/notice mapping. Unmapped categories stay denied. */
  categories?: Partial<
    Record<"measurement" | "marketing" | "experience" | "functionality", string>
  >;
  /**
   * The key of the privacy notice that covers analytics, as you named it in
   * Fides. Defaults to `analytics`.
   */
  notice?: string;
  /** Your Fides privacy center's origin, which serves `fides.js`. */
  privacyCenter: string;
  /** The Fides property to load, when you have more than one. */
  propertyId?: string;
}

export const ethycaOptionsSchema = z.strictObject({
  categories: z
    .partialRecord(
      z.enum(["measurement", "marketing", "experience", "functionality"]),
      z.string().min(1)
    )
    .optional(),
  notice: z.string().min(1).optional(),
  privacyCenter: z.url({ protocol: /^https?$/u }),
  propertyId: z.string().min(1).optional(),
});

export type EthycaAdapter = AdapterDescriptor<"ethyca", EthycaOptions>;

export const ethycaAdapterSchema = adapterDescriptorSchema(
  "ethyca",
  ethycaOptionsSchema
);

/**
 * Ethyca's Fides consent manager, loaded from your privacy center. Fides
 * shows its own banner and modal, set up in Fides, and Blume runs the
 * analytics once the reader's analytics notice is on. Nothing here is
 * secret.
 */
export const ethyca = (options: EthycaOptions): EthycaAdapter => ({
  kind: "ethyca",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});

/** Fides' synchronous bootstrap; c15t observes its decisions separately. */
export const ethycaHead = (options: EthycaOptions): HeadScript[] => {
  const src = new URL(
    "fides.js",
    `${options.privacyCenter.replace(/\/+$/u, "")}/`
  );
  if (options.propertyId) {
    src.searchParams.set("property_id", options.propertyId);
  }
  return [{ attributes: { src: src.href }, content: null }];
};
