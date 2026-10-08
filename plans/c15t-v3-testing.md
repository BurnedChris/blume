# Test the c15t v3 integration

This draft replaces Blume's consent state machine and vendor loaders with c15t's Astro integration. Blume owns configuration, application event names, and the boundary that keeps raw search and assistant text out of vendor events. c15t owns consent evaluation, script lifecycle, SDK callbacks, and event delivery. Osano and Fides can remain the consent authority and UI while c15t runs the scripts.

## Dependencies

Blume pins the published c15t v3 alphas exactly (`@c15t/astro`, `@c15t/core`, `@c15t/react` at `3.0.0-alpha.8`; `@c15t/integrations` at `3.0.0-alpha.7`, the latest publish of that package from the same release train). `@c15t/integrations` replaced `@c15t/scripts`, which is now a deprecated re-export. They include the external consent source and event dispatcher from [c15t/c15t#1204](https://github.com/c15t/c15t/pull/1204). Prerelease ranges would float to later alphas whose API may differ, so bump the pins deliberately and rerun the checks below.

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

## c15t alpha.3 workarounds

Blume works around three c15t issues. Each has a comment at its site; remove them once c15t ships the fix.

- Astro 7 drops CSS that a page script reaches only through a dynamic import, so the React and Svelte dialog islands open unstyled. c15t already injects `@c15t/ui/styles/dialog.css` page-wide for Vue; Blume does the same for React (`consent/integration.ts`). Reproduces in a bare Astro 7 app with `ui: 'react'` or `'svelte'`; Astro 5 emits the chunk's CSS.
- The Astro dialog islands pass no `colorScheme` to the framework provider, so React's `useColorScheme(undefined)` mirrors a `.dark` class onto `c15t-dark` while the dialog is open. Blume sets `colorScheme: "light"` (c15t leaves the class alone), then owns `c15t-dark` and keeps `.dark` in step with `data-theme` (`consent/runtime.ts`, `ConsentHead.astro`). The fix upstream is `colorScheme: null` in `buildProviderProps`.
- `--consent-manager-font-family` is a hardcoded system stack rather than `var(--c15t-font-family)`, so the preference list ignores the theme font (`consent/c15t.css`).

The banner and dialog map c15t's color, radius, shadow and font tokens to `--blume-*` variables, which switch with the theme, so one set of values serves both palettes. A site's `c15t({ theme })` overrides them group by group.

## UI workarounds for the pinned alphas

Blume works around four `@c15t/astro` 3.0.0-alpha.3 gaps. Remove each once c15t ships the fix:

- Astro 7 drops CSS reached only through a page script's dynamic import, so the React and Svelte dialog islands open unstyled. Blume imports `@c15t/ui/styles/dialog.css` page-wide, as c15t already does for Vue (`src/consent/integration.ts`).
- The dialog islands mount `ConsentProvider` without a `colorScheme`, so React mirrors a `.dark` class onto `c15t-dark` while the dialog is open. Blume passes `colorScheme: "light"`, owns `c15t-dark` itself, and keeps `.dark` in sync with its theme (`src/consent/runtime.ts`, `ConsentHead.astro`).
- `--consent-manager-font-family` is a hardcoded system stack rather than `var(--c15t-font-family)` (`src/consent/c15t.css`).
- The server-rendered banner ignores `theme.consentActions` and lays out actions by viewport width, so a narrow card on a wide screen overflows. Blume clears `primaryActions` and lays out the sidebar-width banner's footer itself (`src/consent/c15t.css`).

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
