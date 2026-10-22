---
"blume": minor
---

Add `c15t()` to `blume/consent`. It runs c15t's banner and preferences dialog through c15t's Astro integration, styled with the site's theme, and Blume's analytics wait for c15t's `measurement` category. Scripts load the way they do on any c15t site: plain ones in `scripts` on `c15t()`, and `@c15t/integrations` helpers in a `c15t.client.ts` next to `blume.config.ts`. Install `@c15t/astro` and `@c15t/react` to use it.
