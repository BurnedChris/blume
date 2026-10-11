# Test the c15t v3 integration

This draft replaces Blume's consent state machine and vendor loaders with c15t's Astro integration. Blume owns configuration, application event names, and the boundary that keeps raw search and assistant text out of vendor events. c15t owns consent evaluation, script lifecycle, SDK callbacks, and event delivery. Osano and Fides can remain the consent authority and UI while c15t runs the scripts.

## Dependencies

Blume pins the published c15t v3 alphas exactly (`@c15t/astro` and `@c15t/react` at `3.0.0-alpha.12`; `@c15t/core` and `@c15t/integrations` at `3.0.0-alpha.11`, the latest publishes of those packages from the same release train). `@c15t/integrations` replaced `@c15t/scripts`, which is now a deprecated re-export. They include the external consent source and event dispatcher from [c15t/c15t#1204](https://github.com/c15t/c15t/pull/1204). Prerelease ranges would float to later alphas whose API may differ, so bump the pins deliberately and rerun the checks below.

To upgrade, change the four versions in `packages/blume/package.json`, then:

```sh
bun install
bun run sync:c15t-integrations
bun run check
bun run typecheck
bun run test:coverage
bun run build
```

`sync:c15t-integrations` regenerates the `blume/integrations/*` re-exports and the docs catalog from the installed SDK's export map; commit what it changes.

## Framework boundary

Consent-source synchronization, preference delegation, revocation handling, script loading, and event dispatch belong to c15t's shared core and scripts SDK. The companion PR exposes these controls through React (including Next.js and TanStack Start), Vue/Nuxt, Svelte/SvelteKit, the browser client, and Astro. Solid uses the same headless runtime with its lifecycle hooks; its package currently provides UI primitives.

Blume uses the Astro adapter because its generated site is Astro. Other c15t frameworks do not depend on that adapter. React keeps its script loader lazy, and external preference controls remain accessible while c15t's own choice forms stay hidden.

## Browser verification

Create a small fixture with `docs/index.md`, `docs/next.md`, and a link from the first page to `/next`. Link its `node_modules/blume` to this checkout's `packages/blume`. No consent config is needed; create a root `consent.ts`, which Blume finds by name:

```ts
import { defineConsent } from "blume/consent/client";
import { googleTagManager } from "blume/integrations/google-tag-manager";
export default defineConsent({
  scripts: [googleTagManager({ id: "GTM-TEST" })],
});
```

Run `blume build` from that fixture (use the checkout's `packages/blume/bin/blume.mjs` with Node), then serve its `dist` directory on port 4317. For network-independent builds, set the theme font roles to a local font file as in `test/configured-integrations.test.ts`.

```sh
python3 -m http.server 4317 --bind 127.0.0.1 --directory /absolute/path/to/fixture/dist
# In another terminal, from the Blume checkout:
node scripts/verify-c15t-browser.mjs
```

The browser check uses the docs app's Playwright installation (`bunx playwright install chromium` in `apps/docs` if Chromium is missing) and intercepts the GTM request. It verifies denied event suppression, acceptance, one runtime/container across navigation, a styled preference dialog that follows the site theme rather than the OS color scheme, and withdrawal/reload. It does not send analytics to a real account.

Also test external Osano/Fides initialization, category changes, unavailable provider, withdrawal and preferences against the deployment's real CMP configuration. Unit tests exercise both adapters, missing providers, listener cleanup, theme/language synchronization and the SDK conversion for every legacy analytics adapter.

## Following c15t's Astro setup

Blume renders c15t's own Astro components: `ConsentScript` in the head (first-paint styles, theme tokens, server-resolved config), `ConsentBanner` and `ConsentDialog` in the layout, and `ConsentDialogLink` for the footer's settings link. The banner styles are inlined; the dialog links its stylesheet when it opens.

c15t's alpha.3 gaps are fixed upstream, so the workarounds are gone: the page-wide dialog stylesheet, the `.dark` class mirror, the font-family override, the `@layer` order statement, and Blume's own footer layout. What remains:

- `colorScheme: "none"`. Blume's theme toggle owns `c15t-dark` (`ConsentHead.astro`, `src/consent/runtime.ts`), since c15t's `"system"` would follow the OS while the reader has pinned the site's theme.
- `src/consent/c15t.css` sets c15t's tokens for the footer surface and the "Secured by" tag, and fits the floating banner into the gutter beside the article from `lg`.

The banner and dialog map c15t's color, radius, shadow and font tokens to `--blume-*` variables, which switch with the theme, so one set of values serves both palettes. A site's `c15t({ theme })` overrides them group by group.

## Maintainer decisions and release boundaries

- No analytics and no consent configuration means no consent UI or client assets.
- Analytics alone enables offline c15t and an explicit opt-in policy everywhere. `native()` remains an offline compatibility alias; `c15t()` exposes the Astro options and an optional backend.
- `blume/analytics` is deprecated and frozen, with removal planned for the next major release. Existing configurations produce a migration warning and continue to work. The [user migration guide](../apps/docs/content/docs/configuration/analytics-migration.mdx) covers all adapters, staged adoption, changed defaults, consent behavior, verification, and rollback. `consent.ts` can declare `pageviews` to retain Segment, Hightouch, or legacy-style PostHog router events. Never register a vendor in both APIs.
- `blume/integrations/*` re-exports named public c15t script SDK entries. New scripts and callbacks belong in the root `consent.ts`, preserving functions instead of serializing them. Blume finds it by name like `components.ts`, and its presence alone turns on offline consent. c15t/astro's own `clientEntrypoint` option is Blume's implementation detail, not part of Blume's config. Modes use c15t's `hosted()`, `manifest()`, and `offline()` factories, re-exported from `blume/consent`.
- A helper's `alwaysLoad` policy can initialize a vendor in its denied mode before a decision. Loading GTM does not make all tags inside its container safe: configure those tags' consent requirements. Custom scripts default to the measurement gate.
- External CMP grants are volatile permissions, not c15t receipts. The provider owns decisions, records, expiration and privacy signals. Missing or unavailable providers fail closed; c15t does not mount a second banner or persist fabricated records.
- Blume sets c15t's `reloadOnConsentRevoked` explicitly (c15t also defaults it on) because many executed SDKs cannot unload. The reload follows synchronous consent callbacks and local persistence. Custom c15t options can override it.
- Legacy Blume native storage is not imported as a new receipt. Existing readers are asked again. Configure c15t translation messages for the site's languages; old Blume banner strings are not a c15t message pack.
- c15t reduces duplicated consent-sensitive code and gives Blume one tested lifecycle to maintain. It does not establish legal compliance by itself; policy configuration, category mapping, tag behavior and backend deployment remain application responsibilities.

## Validation of this draft

The migration update passed 5,297 Blume tests with 100% line/function coverage, uncached workspace typechecks, lint/format checks, and the production workspace build. Generated-module regression tests cover SDK-only and mixed configurations, callback preservation, and development behavior. A separate SDK-only Segment fixture passed intercepted Chromium checks for denied loading/events, one initial pageview, router and query pageviews without duplicates, preferences, and withdrawal/reload. Its production guard also prevented vendor loading in development after acceptance and navigation.

The Blume branch is based on the fork's `main`, including its newer search analytics and translated UI changes. The generated GTM-only site, custom client scripts with Fides and Osano, and an ejected Astro app were exercised in Chromium with third-party requests intercepted. Verified: denial, acceptance, preferences, one runtime across navigation, external authority without a c15t receipt/banner, and withdrawal/reload. A no-integration build was checked for absence of c15t assets. The ejected fixture includes a package.json before eject so Astro can discover its declared renderer dependencies.

The companion c15t implementation, [c15t/c15t#1204](https://github.com/c15t/c15t/pull/1204), is merged and shipped in the pinned alphas. Its shared-control checks pass across core and framework packages (4,018 tests), with the scripts suite also verified (434 tests). Build/types/lint passed for affected packages. Package documentation was regenerated from the canonical Astro guide.

## Updating SDK re-exports

The installed `@c15t/integrations` package manifest is the source of truth for named public SDK subpaths. Its integration registry also generates the catalog in the [integrations guide](../apps/docs/content/docs/configuration/integrations.mdx), keeping rendered documentation and Markdown/agent mirrors in sync. After upgrading c15t, run `bun run sync:c15t-integrations` (also included in `bun run fix`) and commit the generated `src/integrations` files and package exports. The generator adds new entries and removes stale ones while preserving unrelated Blume exports. Root, package metadata, blocked exports, and wildcard deep imports are not mirrored.

`bun run check:c15t-integrations` is read-only and fails on missing, changed, or stale exports. `bun run check` includes it, so the existing lint CI job enforces parity. Do not generate during CI installation, since that would hide uncommitted drift.

The export/deprecation update passed 5,300 tests with 100% line/function coverage, uncached typechecks, the production workspace build, and lint/format plus SDK export parity checks. Built CLI `doctor --json` reports one migration warning and no errors for legacy analytics; the SDK-only fixture reports no diagnostics. Generator regression tests cover additions, nested exports, removals, read-only drift detection, and TypeScript condition order.

The integration documentation update passed the same 5,300-test coverage gate and workspace checks. All six guide examples typecheck against the SDK; `blume validate` reports no diagnostics. The built HTML and Markdown/API mirrors include the full generated vendor catalog.
