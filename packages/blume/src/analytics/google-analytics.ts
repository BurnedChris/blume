import { z } from "zod";

import type { AdapterDescriptor, JsonValue } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The options {@link googleAnalytics} maps itself. */
export interface GoogleAnalyticsNamedOptions {
  /** Measurement ID of the GA4 web data stream (`G-…`). */
  id: string;
}

/**
 * Options for {@link googleAnalytics}: the measurement ID plus any other
 * `gtag('config', …)` parameter, forwarded verbatim (`send_page_view`,
 * `anonymize_ip`, `cookie_domain`, `debug_mode`, …). JSON values only.
 */
export type GoogleAnalyticsOptions = GoogleAnalyticsNamedOptions & {
  [parameter: string]: JsonValue;
};

export const googleAnalyticsOptionsSchema = z
  .object({
    id: z.string().min(1),
  })
  .catchall(z.json());

export type GoogleAnalyticsAdapter = AdapterDescriptor<
  "google-analytics",
  GoogleAnalyticsOptions
>;

export const googleAnalyticsAdapterSchema = adapterDescriptorSchema(
  "google-analytics",
  googleAnalyticsOptionsSchema
);

/**
 * Google Analytics 4 through the Google tag (`gtag.js`). The measurement ID is
 * public; it names the data stream the tag reports to.
 *
 * @deprecated Use blume/scripts/* in a consent client entrypoint. Removed in the next major release.
 */
export const googleAnalytics = (
  options: GoogleAnalyticsOptions
): GoogleAnalyticsAdapter => ({
  kind: "google-analytics",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
