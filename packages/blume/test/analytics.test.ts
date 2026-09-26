import { describe, expect, it } from "bun:test";

import { cloudflare, posthog, script, vercel } from "../src/analytics/index.ts";
import { analyticsConfigSchema } from "../src/analytics/schema.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";

describe("analytics adapter factories", () => {
  it("return serializable descriptors that survive a JSON round trip", () => {
    const adapters = [
      posthog({ key: "phc_test" }),
      vercel(),
      cloudflare({ token: "tok" }),
      script({ src: "https://x.test/a.js" }),
    ];
    // JSON on purpose, not structuredClone: the descriptor is written to the
    // generated data.json and read back, so JSON's semantics are the contract.
    // oxlint-disable-next-line unicorn/prefer-structured-clone
    expect(JSON.parse(JSON.stringify(adapters))).toEqual(adapters);
    expect(adapters.map((adapter) => adapter.kind)).toEqual([
      "posthog",
      "vercel",
      "cloudflare",
      "script",
    ]);
  });

  it("declare no runtime deps or secrets — the built-ins ship public tokens", () => {
    for (const adapter of [
      posthog({ key: "phc_test" }),
      vercel(),
      cloudflare({ token: "tok" }),
      script({ content: "noop()" }),
    ]) {
      expect(adapter.runtimeDeps).toEqual([]);
      expect(adapter.requiredSecrets).toEqual([]);
    }
  });

  it("keep the options verbatim, including ones Blume doesn't name", () => {
    const adapter = posthog({ key: "phc_test", persistence: "memory" });
    expect(adapter.options).toEqual({
      key: "phc_test",
      persistence: "memory",
    });
  });

  it("validate through the config schema", () => {
    const config = blumeConfigSchema.parse({
      analytics: [
        posthog({ key: "phc_test", persistence: "memory" }),
        vercel({ mode: "production" }),
        cloudflare({ spa: false, token: "tok" }),
        script({ src: "https://x.test/a.js" }),
      ],
    });
    expect(config.analytics).toHaveLength(4);
    expect(config.analytics[0]?.options).toMatchObject({
      persistence: "memory",
    });
    expect(config.analytics[2]?.options).toMatchObject({ spa: false });
  });
});

describe("analyticsConfigSchema", () => {
  it("defaults to an empty list", () => {
    expect(blumeConfigSchema.parse({}).analytics).toEqual([]);
  });

  it("rejects the pre-adapter object form with the list hint", () => {
    const result = analyticsConfigSchema.safeParse({ vercel: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain(
      'imported from "blume/analytics"'
    );
  });

  it("keeps an adapter's own message for a bad option", () => {
    const result = analyticsConfigSchema.safeParse([
      script({ content: "x", src: "https://x.test/a.js" }),
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain(
      "exactly one of `src` or `content`"
    );
    expect(result.error?.issues[0]?.path).toEqual([0, "options"]);
  });

  it("rejects an unknown kind", () => {
    expect(
      analyticsConfigSchema.safeParse([
        {
          kind: "plausible",
          options: {},
          requiredSecrets: [],
          runtimeDeps: [],
        },
      ]).success
    ).toBe(false);
  });

  it("rejects an empty PostHog key and an unknown Vercel mode", () => {
    expect(
      analyticsConfigSchema.safeParse([posthog({ key: "" })]).success
    ).toBe(false);
    expect(
      analyticsConfigSchema.safeParse([
        { ...vercel(), options: { mode: "staging" } },
      ]).success
    ).toBe(false);
  });

  it("accepts nested JSON in a passthrough option", () => {
    const result = analyticsConfigSchema.safeParse([
      posthog({
        bootstrap: { featureFlags: { beta: true }, ids: [1, 2, null] },
        key: "k",
      }),
      cloudflare({ spa: false, token: "t" }),
      vercel({ endpoint: "https://va.example/api" }),
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects passthrough values JSON would drop or choke on, with a path", () => {
    const cases = [
      ["bigint", 10n],
      ["fn", () => 1],
      ["nan", Number.NaN],
      ["undefined", undefined],
    ] as const;
    for (const [name, value] of cases) {
      const result = analyticsConfigSchema.safeParse([
        { ...posthog({ key: "k" }), options: { key: "k", probe: value } },
      ]);
      expect(result.success, `${name} should be rejected`).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual([0, "options", "probe"]);
    }
    expect(
      analyticsConfigSchema.safeParse([
        { ...vercel(), options: { beforeSend: () => null } },
      ]).success
    ).toBe(false);
    expect(
      analyticsConfigSchema.safeParse([
        {
          ...cloudflare({ token: "t" }),
          options: { spa: undefined, token: "t" },
        },
      ]).success
    ).toBe(false);
  });
});
