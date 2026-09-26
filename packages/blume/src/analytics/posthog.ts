import { z } from "zod";

import type { AdapterDescriptor, JsonValue } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** PostHog Cloud US, the ingestion host `posthog()` uses when `host` is unset. */
export const POSTHOG_DEFAULT_HOST = "https://us.i.posthog.com";

/** The options {@link posthog} maps itself. */
export interface PosthogNamedOptions {
  /** API host (for self-hosted / EU). Defaults to PostHog Cloud US. */
  host?: string;
  /** Project API key. */
  key: string;
}

/**
 * Options for {@link posthog}: the named options plus any other `posthog.init`
 * option, forwarded verbatim (`persistence`, `capture_pageview`,
 * `autocapture`, …). JSON values only.
 */
export type PosthogOptions = PosthogNamedOptions & {
  [option: string]: JsonValue;
};

export const posthogOptionsSchema = z
  .object({
    host: z.string().optional(),
    key: z.string().min(1),
  })
  .catchall(z.json());

export type PosthogAdapter = AdapterDescriptor<"posthog", PosthogOptions>;

export const posthogAdapterSchema = adapterDescriptorSchema(
  "posthog",
  posthogOptionsSchema
);

/**
 * PostHog product analytics. The project API key is public and write-only, so
 * it is safe to ship to the browser.
 *
 * @deprecated Use blume/integrations/* in a consent client entrypoint. Removed in the next major release.
 */
export const posthog = (options: PosthogOptions): PosthogAdapter => ({
  kind: "posthog",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
