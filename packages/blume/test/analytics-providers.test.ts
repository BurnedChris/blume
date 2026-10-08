import { describe, expect, it } from "bun:test";

import {
  adobe,
  amplitude,
  clarity,
  clearbit,
  databuddy,
  fathom,
  googleAnalytics,
  googleTagManager,
  heap,
  hightouch,
  hotjar,
  logrocket,
  mixpanel,
  oneDollarStats,
  pirsch,
  plausible,
  segment,
} from "../src/analytics/index.ts";
import { analyticsConfigSchema } from "../src/analytics/schema.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";

// Every provider adapter with the smallest valid call, in the order the docs
// list them.
const all = () => [
  adobe({ url: "https://assets.adobedtm.com/x/launch-y.min.js" }),
  amplitude({ key: "amp" }),
  clarity({ id: "abc123" }),
  clearbit({ key: "pk_1a1882" }),
  databuddy({ clientId: "client" }),
  fathom({ site: "YSVMSDAY" }),
  googleAnalytics({ id: "G-XXXX" }),
  googleTagManager({ id: "GTM-XXXX" }),
  heap({ id: "1234567890" }),
  hightouch({ key: "wk" }),
  hotjar({ id: 1234 }),
  logrocket({ id: "org/app" }),
  mixpanel({ token: "tok" }),
  oneDollarStats(),
  pirsch({ code: "code" }),
  plausible({ domain: "docs.example.com" }),
  segment({ key: "wk" }),
];

describe("provider adapter factories", () => {
  it("return serializable descriptors with public tokens and no runtime deps", () => {
    const adapters = all();
    // oxlint-disable-next-line unicorn/prefer-structured-clone
    expect(JSON.parse(JSON.stringify(adapters))).toEqual(adapters);
    expect(adapters.map((adapter) => adapter.kind)).toEqual([
      "adobe",
      "amplitude",
      "clarity",
      "clearbit",
      "databuddy",
      "fathom",
      "google-analytics",
      "google-tag-manager",
      "heap",
      "hightouch",
      "hotjar",
      "logrocket",
      "mixpanel",
      "one-dollar-stats",
      "pirsch",
      "plausible",
      "segment",
    ]);
    for (const adapter of adapters) {
      expect(adapter.runtimeDeps).toEqual([]);
      expect(adapter.requiredSecrets).toEqual([]);
    }
  });

  it("validate through the config schema, passthrough included", () => {
    const config = blumeConfigSchema.parse({
      analytics: [
        ...all(),
        amplitude({ key: "amp", serverZone: "EU" }),
        fathom({ site: "S", spa: "auto" }),
        mixpanel({ persistence: "localStorage", region: "eu", token: "t" }),
        databuddy({ clientId: "c", "track-web-vitals": "true" }),
        oneDollarStats({ hostname: "docs.example.com" }),
      ],
    });
    expect(config.analytics).toHaveLength(22);
    expect(config.analytics[17]?.options).toMatchObject({ serverZone: "EU" });
    expect(config.analytics[18]?.options).toMatchObject({ spa: "auto" });
    expect(config.analytics[19]?.options).toMatchObject({ region: "eu" });
    expect(config.analytics[20]?.options).toMatchObject({
      "track-web-vitals": "true",
    });
    expect(config.analytics[21]?.options).toMatchObject({
      hostname: "docs.example.com",
    });
  });

  it("reject an empty identifier on every adapter", () => {
    const empties = [
      adobe({ url: "" }),
      amplitude({ key: "" }),
      clarity({ id: "" }),
      clearbit({ key: "" }),
      databuddy({ clientId: "" }),
      fathom({ site: "" }),
      googleAnalytics({ id: "" }),
      googleTagManager({ id: "" }),
      heap({ id: "" }),
      hightouch({ key: "" }),
      logrocket({ id: "" }),
      mixpanel({ token: "" }),
      pirsch({ code: "" }),
      plausible({ domain: "" }),
      segment({ key: "" }),
    ];
    for (const adapter of empties) {
      const result = analyticsConfigSchema.safeParse([adapter]);
      expect(result.success, `${adapter.kind} should reject ""`).toBe(false);
    }
  });

  it("reject a non-string data attribute, a non-bare OneDollarStats hostname, an unknown region, and a fractional Hotjar id", () => {
    expect(
      analyticsConfigSchema.safeParse([
        { ...fathom({ site: "S" }), options: { site: "S", spa: true } },
      ]).success
    ).toBe(false);
    expect(
      analyticsConfigSchema.safeParse([
        {
          ...databuddy({ clientId: "c" }),
          options: { clientId: "c", "track-errors": true },
        },
      ]).success
    ).toBe(false);
    expect(
      analyticsConfigSchema.safeParse([
        { ...oneDollarStats(), options: { devmode: true } },
      ]).success
    ).toBe(false);
    for (const hostname of [
      "https://docs.example.com",
      "docs.example.com/guide",
      "docs.example.com?ref=x",
      "docs.example.com#top",
      "user@docs.example.com",
      "docs..example.com",
      "",
    ]) {
      expect(
        analyticsConfigSchema.safeParse([oneDollarStats({ hostname })]).success,
        `hostname ${JSON.stringify(hostname)} should be rejected`
      ).toBe(false);
    }
    for (const hostname of [
      "docs.example.com",
      "localhost:4321",
      "bücher.example",
    ]) {
      expect(
        analyticsConfigSchema.safeParse([oneDollarStats({ hostname })]).success,
        `hostname ${JSON.stringify(hostname)} should be accepted`
      ).toBe(true);
    }
    expect(
      analyticsConfigSchema.safeParse([
        { ...mixpanel({ token: "t" }), options: { region: "ap", token: "t" } },
      ]).success
    ).toBe(false);
    expect(analyticsConfigSchema.safeParse([hotjar({ id: 1.5 })]).success).toBe(
      false
    );
    expect(
      analyticsConfigSchema.safeParse([
        { ...hotjar({ id: 1 }), options: { id: 1, probe: 2 } },
      ]).success
    ).toBe(false);
  });
});
