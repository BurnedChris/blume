import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The script OneDollarStats' install snippet loads. */
export const ONE_DOLLAR_STATS_SCRIPT_SRC =
  "https://assets.onedollarstats.com/stonks.js";

/** The options {@link oneDollarStats} checks itself. */
export interface OneDollarStatsNamedOptions {
  /**
   * A bare host name, e.g. `docs.example.com`. The tracker reports every
   * event under it on every host, not just `localhost`.
   */
  hostname?: string;
}

/**
 * Options for {@link oneDollarStats}: any tracker setting, forwarded as a
 * `data-` attribute on the tag (`hostname` → `data-hostname`, `devmode`,
 * `url`, `autocollect`, `"hash-routing"`, …).
 */
export type OneDollarStatsOptions = OneDollarStatsNamedOptions & {
  [setting: string]: string;
};

export const oneDollarStatsOptionsSchema = z
  .object({
    hostname: z
      .string()
      .regex(/^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*(?::\d+)?$/u, {
        message:
          "`hostname` must be a bare host name like `docs.example.com`, without `https://`, a path, a query, or a fragment.",
      })
      .optional(),
  })
  .catchall(z.string());

export type OneDollarStatsAdapter = AdapterDescriptor<
  "one-dollar-stats",
  OneDollarStatsOptions
>;

export const oneDollarStatsAdapterSchema = adapterDescriptorSchema(
  "one-dollar-stats",
  oneDollarStatsOptionsSchema
);

/**
 * OneDollarStats. Needs no keys — the dashboard matches events to a site by
 * the domain they come from.
 */
export const oneDollarStats = (
  options: OneDollarStatsOptions = {}
): OneDollarStatsAdapter => ({
  kind: "one-dollar-stats",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
