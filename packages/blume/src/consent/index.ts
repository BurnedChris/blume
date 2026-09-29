/** Consent providers share one c15t script runtime. */
export { c15t } from "./c15t.ts";
// c15t v3's mode factories, so `mode: hosted({ url })` reads as in c15t/astro.
export { hosted, manifest, offline } from "@c15t/astro";
export type { C15tOptions, C15tAdapter, ConsentClientOptions } from "./c15t.ts";
export type { AdapterDescriptor, JsonValue } from "../core/adapter.ts";
export { ethyca } from "./ethyca.ts";
export type { EthycaAdapter, EthycaOptions } from "./ethyca.ts";
export { native } from "./native.ts";
export type { NativeAdapter, NativeOptions } from "./native.ts";
export { osano } from "./osano.ts";
export type { OsanoAdapter, OsanoOptions } from "./osano.ts";
export type { ConsentAdapter } from "./schema.ts";
