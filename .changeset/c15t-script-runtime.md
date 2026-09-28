---
"blume": minor
---

Use c15t v3 for consent and script lifecycle management. Analytics-only configurations now enable an offline consent banner; existing analytics factories use the c15t SDK, whose public script exports are also available through `blume/integrations/*`. Support c15t backends and external Osano/Fides decision sources, consent-aware event delivery, and Astro navigation. Keep raw search queries in local application events instead of forwarding them to vendor SDKs. The consent banner and preference dialog take Blume's colors, corners, overlay and fonts, and follow the site's light/dark toggle; a site's own c15t `theme` values still take precedence. Existing native consent storage is not migrated; visitors are asked again.

Deprecate and freeze `blume/analytics` until its removal in the next major release. Emit migration warnings for existing analytics lists, document every adapter migration and rollback, and expose typed client configuration with explicit navigation pageviews for SDK-only and mixed setups. The legacy `oneDollarStats()` adapter now runs through the SDK's `oneDollarStats()` helper, which rejects setting names outside lowercase letters, digits, and hyphens, and omits `data-hash-routing` when set to `"false"` since the tracker treats the attribute as presence-based.

Style the c15t banner and preferences dialog from the site's theme tokens (colors, corners, fonts) and its light/dark toggle, fit the banner to the docs sidebar on wide screens, and give its actions equal weight.

Scripts and callbacks go in a root `consent.ts`, found by name like `components.ts`, typed with `defineConsent` from `blume/consent/client`; its presence alone turns on offline consent. `blume/consent` re-exports c15t's `hosted()`, `manifest()`, and `offline()` mode factories.

Generate direct script re-exports from the installed c15t SDK manifest and enforce export parity in lint checks.

Document SDK integration setup, the generated vendor catalog, consent providers, pageviews, events, and custom scripts. Add sidebar navigation and update the configuration overview.

Expose the direct SDK re-exports under `blume/integrations/*`.
