---
"blume": patch
---

A site can now ship a single color scheme. `theme: { mode: "dark", toggle: false }` drops the light/dark toggle from the header and renders every page dark, including for readers who picked light before the toggle was removed. Before, `theme.mode` only set the starting scheme: the toggle always showed, and a reader's saved choice outranked it. With `mode: "system"`, `toggle: false` follows each reader's OS setting.
