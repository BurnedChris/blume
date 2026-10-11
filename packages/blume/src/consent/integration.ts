import { c15t as astroConsent } from "@c15t/astro";
import type { C15tAstroOptions, Theme } from "@c15t/astro";
import type { AstroIntegration } from "astro";

import { analyticsClientModule } from "../analytics/c15t.ts";
import type { AnalyticsAdapter } from "../analytics/schema.ts";
import { findConsentFile } from "../core/project.ts";
import type { ConsentAdapter } from "./schema.ts";

const ENTRY = "virtual:blume/consent-client";

/**
 * c15t's tokens drawn from Blume's own, so the banner and dialog share the
 * site's palette, corners, overlay and fonts. The `--blume-*` variables flip
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

/** One c15t runtime for generated and ejected Astro sites. */
export const blumeConsentIntegrations = (input: {
  consent: ConsentAdapter;
  analytics: AnalyticsAdapter[];
  root: string;
  basePath?: string;
}): AstroIntegration[] => {
  const { consent } = input;
  const configured = consent.kind === "c15t" ? consent.options : undefined;
  const options: C15tAstroOptions = {
    consentCategories: [
      "necessary",
      "functionality",
      "experience",
      "measurement",
      "marketing",
    ],
    // c15t defaults this on; pin it so an upstream default change can't
    // silently leave executed SDKs running after withdrawal.
    reloadOnConsentRevoked: true,
    ...configured,
    clientEntrypoint: ENTRY,
    // Blume's theme toggle owns `c15t-dark` (ConsentHead and the runtime).
    // c15t's "system" would re-add it on an OS change while the reader has
    // pinned the site light; "none" leaves the class to the site.
    colorScheme: "none",
    // Without geo/backend data, explicitly ask everywhere.
    mode:
      configured?.mode?.type === "hosted" ||
      configured?.mode?.type === "manifest"
        ? configured.mode
        : {
            policyRules: [
              {
                id: "blume-global-opt-in",
                match: { fallback: true, isDefault: true },
                model: "opt-in",
                prompt: "choice",
              },
            ],
            type: "offline",
            ...configured?.mode,
          },
    // c15t makes Customize the one accent-colored action. Blume's buttons
    // share one bordered style, as the pre-c15t banner's did, so no action
    // outranks the equal-weight Reject/Accept pair.
    presentation: {
      ...configured?.presentation,
      prompt: { primaryActions: [], ...configured?.presentation?.prompt },
    },
    theme: blumeTheme(configured?.theme),
    ui: "react",
  };
  if (consent.kind === "native" && consent.options.policy) {
    const { policy } = consent.options;
    options.legalLinks = {
      privacyPolicy: {
        href: policy.startsWith("/")
          ? `${input.basePath ?? ""}${policy}`
          : policy,
      },
    };
  }
  return [
    {
      hooks: {
        "astro:config:setup": ({ injectScript }) => {
          injectScript("page-ssr", 'import "blume/consent/c15t.css";');
        },
      },
      name: "blume:consent-styles",
    },
    astroConsent(options),
    {
      hooks: {
        "astro:config:setup": ({
          command,
          config,
          injectScript,
          updateConfig,
        }) => {
          // The project's `consent.ts` (scripts and callbacks), found by
          // name like `components.ts`; eject keeps it at the same root.
          const userEntry = findConsentFile(input.root);
          updateConfig({
            vite: {
              plugins: [
                {
                  load(id) {
                    if (id !== `\0${ENTRY}`) {
                      return;
                    }
                    const userImport = userEntry
                      ? `import extension from ${JSON.stringify(userEntry)};`
                      : "const extension = {};";
                    return `${userImport}
${analyticsClientModule(command === "dev" ? [] : input.analytics, config.base)}
import { externalConsentSource } from "blume/consent/runtime";
export default { ...extension, pageviews: [...pageviews, ...(extension.pageviews ?? [])], scripts: [...scripts, ...(extension.scripts ?? [])], consentSource: externalConsentSource(${JSON.stringify(consent)}) ?? extension.consentSource };`;
                  },
                  name: "blume:consent-client",
                  resolveId(id) {
                    return id === ENTRY ? `\0${ENTRY}` : undefined;
                  },
                },
              ],
            },
          });
          injectScript(
            "page",
            `import { startConsentRuntime } from "blume/consent/runtime"; import extension from "virtual:blume/consent-client"; startConsentRuntime(extension.scripts, extension.pageviews);`
          );
        },
      },
      name: "blume:consent",
    },
  ];
};
