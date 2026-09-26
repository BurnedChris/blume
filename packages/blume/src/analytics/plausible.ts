import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** Plausible Cloud, the origin `plausible()` loads the script from when `host` is unset. */
export const PLAUSIBLE_DEFAULT_HOST = "https://plausible.io";

/** The options {@link plausible} maps itself. */
export interface PlausibleNamedOptions {
  /** The site's domain as added in Plausible, e.g. `docs.example.com`. */
  domain: string;
  /**
   * Origin of a self-hosted (or proxied) Plausible instance, e.g.
   * `https://plausible.example.com`. Defaults to Plausible Cloud.
   */
  host?: string;
}

/**
 * Options for {@link plausible}: the named options plus any other script
 * setting, forwarded as a `data-` attribute on the tag (`api` → `data-api`,
 * `"exclude"`, `"include"`, …).
 */
export type PlausibleOptions = PlausibleNamedOptions & {
  [setting: string]: string;
};

export const plausibleOptionsSchema = z
  .object({
    domain: z.string().min(1),
    host: z.string().min(1).optional(),
  })
  .catchall(z.string());

export type PlausibleAdapter = AdapterDescriptor<"plausible", PlausibleOptions>;

export const plausibleAdapterSchema = adapterDescriptorSchema(
  "plausible",
  plausibleOptionsSchema
);

/**
 * Plausible Analytics. Nothing here is secret: the tag names the site and
 * where to send events.
 */
export const plausible = (options: PlausibleOptions): PlausibleAdapter => ({
  kind: "plausible",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
