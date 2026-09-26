# Test the c15t v3 integration

This draft replaces Blume's consent state machine and vendor loaders with c15t's Astro integration. Blume owns configuration, application event names, and the boundary that keeps raw search and assistant text out of vendor events. c15t owns consent evaluation, script lifecycle, SDK callbacks, and event delivery. Osano and Fides can remain the consent authority and UI while c15t runs the scripts.

## Prepare the unpublished dependency

Use [c15t/c15t#1204](https://github.com/c15t/c15t/pull/1204), the companion `christopher/blume-runtime` branch based on `v3`. An existing alpha without that branch does not contain the external consent source and event dispatcher APIs used here.

In the c15t checkout:

```sh
bun install
bun --bun turbo run build --filter=@c15t/astro --filter=@c15t/react --filter=@c15t/scripts
```

In this Blume checkout, use the pinned Bun version from package.json (1.4.2):

```sh
bun scripts/link-c15t.ts /absolute/path/to/c15t
bun install
bun run check
bun run typecheck
bun run test:coverage
bun run build
```

The preparation script copies the packages' distribution files into ignored `.c15t-local` workspaces. The four `file:` dependencies are intentionally temporary. Rebuild and rerun the preparation command after editing c15t. Blume's coverage gate excludes these external distributions; the c15t checkout runs its own coverage suites.

Before merging or publishing, replace the file dependencies with the released alpha versions, remove the temporary workspaces and linking script, regenerate the lockfile, and verify a clean install and packed consumer build. Until that change, a clean checkout and ordinary CI install require the preparation step above. Do not publish Blume with these file dependencies.

## Framework boundary

Consent-source synchronization, preference delegation, revocation handling, script loading, and event dispatch belong to c15t's shared core and scripts SDK. The companion PR exposes these controls through React (including Next.js and TanStack Start), Vue/Nuxt, Svelte/SvelteKit, the browser client, and Astro. Solid uses the same headless runtime with its lifecycle hooks; its package currently provides UI primitives.

Blume uses the Astro adapter because its generated site is Astro. Other c15t frameworks do not depend on that adapter. React keeps its script loader lazy, and external preference controls remain accessible while c15t's own choice forms stay hidden.

## Browser verification

Create a small fixture with `docs/index.md`, `docs/next.md`, and a link from the first page to `/next`. Link its `node_modules/blume` to this checkout's `packages/blume`. Configure:

```ts
import { googleTagManager } from "blume/analytics";
export default {
  analytics: [googleTagManager({ id: "GTM-TEST" })],
};
```

Run `blume build` from that fixture (use the checkout's `packages/blume/bin/blume.mjs` with Node), then serve its `dist` directory on port 4317. For network-independent builds, set the theme font roles to a local font file as in `test/configured-integrations.test.ts`.

```sh
python3 -m http.server 4317 --bind 127.0.0.1 --directory /absolute/path/to/fixture/dist
# In another terminal, from the Blume checkout:
node scripts/verify-c15t-browser.mjs /absolute/path/to/c15t
```

The browser check uses the c15t checkout's Playwright installation and intercepts the GTM request. It verifies denied event suppression, acceptance, one runtime/container across navigation, preferences, and withdrawal/reload. It does not send analytics to a real account.

Also test external Osano/Fides initialization, category changes, unavailable provider, withdrawal and preferences against the deployment's real CMP configuration. Unit tests exercise both adapters, missing providers, listener cleanup, theme/language synchronization and the SDK conversion for every legacy analytics adapter.

## Maintainer decisions and release boundaries

- No analytics and no consent configuration means no consent UI or client assets.
- Analytics alone enables offline c15t and an explicit opt-in policy everywhere. `native()` remains an offline compatibility alias; `c15t()` exposes the Astro options and an optional backend.
- `blume/scripts/*` re-exports named public c15t script SDK entries. New scripts and callbacks belong in `clientEntrypoint`, preserving functions instead of serializing them.
- A helper's `alwaysLoad` policy can initialize a vendor in its denied mode before a decision. Loading GTM does not make all tags inside its container safe: configure those tags' consent requirements. Custom scripts default to the measurement gate.
- External CMP grants are volatile permissions, not c15t receipts. The provider owns decisions, records, expiration and privacy signals. Missing or unavailable providers fail closed; c15t does not mount a second banner or persist fabricated records.
- Blume enables c15t's `reloadOnRevocation` by default because many executed SDKs cannot unload. The reload follows synchronous consent callbacks and local persistence. Custom c15t options can override it.
- Legacy Blume native storage is not imported as a new receipt. Existing readers are asked again. Configure c15t translation messages for the site's languages; old Blume banner strings are not a c15t message pack.
- c15t reduces duplicated consent-sensitive code and gives Blume one tested lifecycle to maintain. It does not establish legal compliance by itself; policy configuration, category mapping, tag behavior and backend deployment remain application responsibilities.

## Validation of this draft

The Blume branch is based on the fork's `main`, including its newer search analytics and translated UI changes. The generated GTM-only site, custom client scripts with Fides and Osano, and an ejected Astro app were exercised in Chromium with third-party requests intercepted. Verified: denial, acceptance, preferences, one runtime across navigation, external authority without a c15t receipt/banner, and withdrawal/reload. A no-integration build was checked for absence of c15t assets. The ejected fixture includes a package.json before eject so Astro can discover its declared renderer dependencies.

The companion c15t implementation is published in [c15t/c15t#1204](https://github.com/c15t/c15t/pull/1204), commit `1f4d22e9` on `christopher/blume-runtime`. Its targeted checks pass: core (1,296 tests), Astro (319), scripts (434), and build/types/lint for those packages. Package documentation was regenerated from the canonical Astro guide. Check out that branch before preparing the local dependencies.
