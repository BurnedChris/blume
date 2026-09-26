---
"blume": minor
---

Use c15t v3 for consent and script lifecycle management. Analytics-only configurations now enable an offline consent banner; existing analytics factories use the c15t SDK, whose public script exports are also available through `blume/scripts/*`. Support c15t backends and external Osano/Fides decision sources, consent-aware event delivery, and Astro navigation. Keep raw search queries in local application events instead of forwarding them to vendor SDKs. Existing native consent storage is not migrated; visitors are asked again.
