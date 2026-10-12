import type { C15tClientOptionsExtension } from "@c15t/astro";

/**
 * What a project's `consent.ts` exports: c15t's browser options, whose
 * scripts and callbacks carry functions and so can't go in `blume.config.ts`.
 */
export interface ConsentClientOptions extends C15tClientOptionsExtension {
  /** Forward router pageviews through c15t for SDKs without history tracking. */
  pageviews?: ("posthog" | "segment" | "hightouch")[];
}

/**
 * Type a `consent.ts` default export. It lives on its own entry because
 * `consent.ts` runs in the browser: importing it from `blume/consent` would
 * pull the config-side adapters into every page.
 */
export const defineConsent = (
  options: ConsentClientOptions
): ConsentClientOptions => options;
