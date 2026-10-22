import { existsSync } from "node:fs";

import { c15t as c15tIntegration } from "@c15t/astro";
import type { C15tAstroOptions, Theme } from "@c15t/astro";
import type { AstroIntegration } from "astro";
import { join, resolve } from "pathe";

import type { C15tOptions } from "./c15t.ts";

/**
 * Where c15t's client entrypoint lives in a Blume project: next to
 * `blume.config.ts`, the way `components.ts` does. Plain c15t sites keep it
 * in `src/`, which a Blume project doesn't have.
 */
const CLIENT_ENTRY_FILENAMES = [
  "c15t.client.ts",
  "c15t.client.js",
  "c15t.client.mjs",
];

/** The env vars c15t reads its backend URL from when `backendURL` is unset. */
const BACKEND_URL_ENVS = ["PUBLIC_C15T_BACKEND_URL", "PUBLIC_INTH_PROJECT_URL"];

/**
 * c15t's tokens drawn from Blume's own, so the banner and dialog share the
 * site's palette, corners, overlay, and fonts. The `--blume-*` variables flip
 * with the theme, so the same values serve c15t's dark palette too.
 */
const BLUME_THEME = {
  colors: {
    border: "var(--blume-border)",
    borderHover: "var(--blume-foreground)",
    overlay: "oklch(0 0 0 / 0.4)",
    primary: "var(--blume-action)",
    primaryHover:
      "color-mix(in oklab, var(--blume-action) 85%, var(--blume-background))",
    surface: "var(--blume-background)",
    surfaceHover: "var(--blume-muted)",
    // The thumb contrasts with both tracks in either theme: the action color
    // when on, a mid-tone gray when off.
    switchThumb: "var(--blume-background)",
    switchTrack:
      "color-mix(in oklab, var(--blume-muted-foreground) 55%, var(--blume-background))",
    switchTrackActive: "var(--blume-action)",
    text: "var(--blume-foreground)",
    textMuted: "var(--blume-muted-foreground)",
    textOnPrimary: "var(--blume-action-foreground)",
  },
  // The page behind a dark-mode dialog is already near black, so the scrim
  // has to be denser before it reads as pushing the page back.
  dark: { overlay: "oklch(0 0 0 / 0.7)" },
  radius: {
    lg: "var(--blume-radius)",
    md: "var(--blume-radius)",
    sm: "calc(var(--blume-radius) / 2)",
  },
  // Blume's own floating cards use Tailwind's `shadow-lg`.
  shadows: {
    lg: "0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1)",
  },
  typography: { fontFamily: "var(--blume-font-body)" },
} satisfies Theme;

/** Blume's defaults under the site's own c15t `theme`, one token group at a time. */
const blumeTheme = (configured: Theme = {}): Theme => ({
  ...configured,
  colors: { ...BLUME_THEME.colors, ...configured.colors },
  dark: { ...BLUME_THEME.dark, ...configured.dark },
  radius: { ...BLUME_THEME.radius, ...configured.radius },
  shadows: { ...BLUME_THEME.shadows, ...configured.shadows },
  typography: { ...BLUME_THEME.typography, ...configured.typography },
});

/**
 * The client entrypoint c15t loads: the site's own `clientEntrypoint`,
 * resolved from the Blume project rather than the hidden `.blume` runtime,
 * or else a `c15t.client.*` next to `blume.config.ts`.
 */
export const c15tClientEntrypoint = (
  options: C15tOptions,
  root: string
): string | undefined => {
  if (options.clientEntrypoint) {
    return resolve(root, options.clientEntrypoint);
  }
  return CLIENT_ENTRY_FILENAMES.map((name) => join(root, name)).find((path) =>
    existsSync(path)
  );
};

/**
 * With no backend in sight (no `mode`, `backendURL`, or backend env var),
 * c15t's default `manifest()` would fail the build. Blume's banner then
 * works offline instead, and asks everywhere, since there's no location to
 * pick a regional policy by.
 */
const offlineDefault = (
  options: C15tOptions,
  env: NodeJS.ProcessEnv
): Pick<C15tAstroOptions, "mode"> =>
  options.mode ||
  options.backendURL !== undefined ||
  BACKEND_URL_ENVS.some((name) => env[name])
    ? {}
    : {
        mode: {
          policyRules: [
            {
              id: "blume-global-opt-in",
              match: { fallback: true, isDefault: true },
              model: "opt-in",
              prompt: "choice",
            },
          ],
          type: "offline",
        },
      };

/** The options Blume hands c15t's integration: the site's, over Blume's defaults. */
export const c15tAstroOptions = (
  options: C15tOptions,
  root: string,
  env: NodeJS.ProcessEnv = process.env
): C15tAstroOptions => ({
  ...offlineDefault(options, env),
  ...options,
  clientEntrypoint: c15tClientEntrypoint(options, root),
  // Blume's theme toggle owns `c15t-dark` (`C15tHead.astro` and the browser
  // module). c15t's "system" would re-add it on an OS change while the
  // reader has pinned the site light; "none" leaves the class to the site.
  colorScheme: "none",
  // c15t makes Customize the one accent-colored action. Blume's buttons
  // share one bordered style, like `native()`'s banner, so no action
  // outranks the equal-weight Reject/Accept pair.
  presentation: {
    ...options.presentation,
    prompt: { primaryActions: [], ...options.presentation?.prompt },
  },
  theme: blumeTheme(options.theme),
  // The dialog island is React, which Blume already renders.
  ui: "react",
});

/**
 * The Astro integrations behind `consent: c15t()`: Blume's stylesheet for
 * c15t's surfaces, then c15t's own integration, which adds its middleware,
 * its boot script, and the scripts from its options and client entrypoint.
 */
export const blumeC15t = (input: {
  options: C15tOptions;
  root: string;
}): AstroIntegration[] => [
  {
    hooks: {
      "astro:config:setup": ({ injectScript }) => {
        injectScript("page-ssr", 'import "blume/consent/c15t.css";');
      },
    },
    name: "blume:c15t-styles",
  },
  c15tIntegration(c15tAstroOptions(input.options, input.root)),
];
