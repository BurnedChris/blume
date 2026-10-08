---
"blume": patch
---

Update c15t to 3.0.0-alpha.8 and move vendor helpers from `@c15t/scripts` to its replacement, `@c15t/integrations`. Adds `blume/integrations/sentry` and `blume/integrations/klaviyo`. The integrations catalog now shows vendors that need a combination of consent categories, such as Sentry's `necessary` or `measurement`.

`manifest()` mode now bundles the backend's policy at build time, so the banner's decision comes from the site's own server without a request to the backend. Set `buildManifest: false` on `c15t()` to fetch the policy at runtime instead.
