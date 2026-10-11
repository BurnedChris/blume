---
"blume": patch
---

Update c15t to 3.0.0-alpha.12 and move vendor helpers from `@c15t/scripts` to its replacement, `@c15t/integrations`. Adds `blume/integrations/sentry`, `blume/integrations/klaviyo`, and `blume/integrations/vercel-speed-insights`. The integrations catalog now shows vendors that need a combination of consent categories, such as Sentry's `necessary` or `measurement`.

c15t's backend URL is now a top-level option, `c15t({ backendURL, mode: hosted() })`, or `PUBLIC_C15T_BACKEND_URL` in `.env`; `hosted({ url })` is gone. `manifest()` mode bundles the backend's policy at build time, so the banner's decision comes from the site's own server without a request to the backend. Use `manifest({ source: "runtime" })` to fetch the policy at runtime instead.

The banner's styles are inlined in the page head, so it paints styled on first load, and the preferences dialog loads its stylesheet when it opens.
