---
"blume": minor
---

Use c15t v3 for consent and script lifecycle management. Analytics-only configurations now enable an offline consent banner; existing analytics factories use the c15t SDK, whose public script exports are also available through `blume/scripts/*`. Support c15t backends and external Osano/Fides decision sources, consent-aware event delivery, and Astro navigation. Keep raw search queries in local application events instead of forwarding them to vendor SDKs. Existing native consent storage is not migrated; visitors are asked again.

Deprecate and freeze `blume/analytics` until its removal in the next major release. Emit migration warnings for existing analytics lists, document every adapter migration and rollback, and expose typed client configuration with explicit navigation pageviews for SDK-only and mixed setups.

Generate direct script re-exports from the installed c15t SDK manifest and enforce export parity in lint checks.
