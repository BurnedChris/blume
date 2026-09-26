import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The script Pirsch's dashboard snippet loads. */
export const PIRSCH_SCRIPT_SRC = "https://api.pirsch.io/pa.js";

/** The options {@link pirsch} maps itself. */
export interface PirschNamedOptions {
  /** Identification code, from Settings → Developer → Identification Code. */
  code: string;
}

/**
 * Options for {@link pirsch}: the identification code plus any other script
 * setting, forwarded as a `data-` attribute on the tag (`dev` → `data-dev`,
 * `exclude`, `include`, `domain`, `endpoint`, …).
 */
export type PirschOptions = PirschNamedOptions & {
  [setting: string]: string;
};

export const pirschOptionsSchema = z
  .object({
    code: z.string().min(1),
  })
  .catchall(z.string());

export type PirschAdapter = AdapterDescriptor<"pirsch", PirschOptions>;

export const pirschAdapterSchema = adapterDescriptorSchema(
  "pirsch",
  pirschOptionsSchema
);

/**
 * Pirsch Analytics. The identification code is public — it's in the tag on
 * every page.
 */
export const pirsch = (options: PirschOptions): PirschAdapter => ({
  kind: "pirsch",
  options,
  requiredSecrets: [],
  runtimeDeps: [],
});
