import path from "node:path";

import { c15t as astroConsent } from "@c15t/astro";
import type { C15tAstroOptions } from "@c15t/astro";
import type { AstroIntegration } from "astro";

import { analyticsClientModule } from "../analytics/c15t.ts";
import type { AnalyticsAdapter } from "../analytics/schema.ts";
import type { ConsentAdapter } from "./schema.ts";

const ENTRY = "virtual:blume/consent-client";
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
    reloadOnRevocation: true,
    ...configured,
    clientEntrypoint: ENTRY,
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
    astroConsent(options),
    {
      hooks: {
        "astro:config:setup": ({ updateConfig, injectScript, command }) => {
          const userEntry =
            "clientEntrypoint" in consent.options
              ? consent.options.clientEntrypoint
              : undefined;
          updateConfig({
            vite: {
              plugins: [
                {
                  load(id) {
                    if (id !== `\0${ENTRY}`) {
                      return;
                    }
                    const userImport = userEntry
                      ? `import extension from ${JSON.stringify(path.resolve(input.root, userEntry))};`
                      : "const extension = {};";
                    return `${userImport}
${analyticsClientModule(command === "dev" ? [] : input.analytics)}
import { externalConsentSource } from "blume/consent/runtime";
export default { ...extension, scripts: [...scripts, ...(extension.scripts ?? [])], consentSource: externalConsentSource(${JSON.stringify(consent)}) ?? extension.consentSource };`;
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
            `import { startConsentRuntime } from "blume/consent/runtime"; import extension, { pageviews } from "virtual:blume/consent-client"; startConsentRuntime(extension.scripts, pageviews);`
          );
        },
      },
      name: "blume:consent",
    },
  ];
};
