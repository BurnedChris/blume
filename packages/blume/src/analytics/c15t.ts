import type { JsonValue } from "../core/adapter.ts";
import type { AnalyticsAdapter } from "./schema.ts";

const attrs = (settings: Record<string, JsonValue>) =>
  Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [
      `data-${key}`,
      String(value),
    ])
  );

/** Compile legacy serializable adapters into real c15t SDK calls in the browser.
 * Only selected vendors are imported. SDK closures never pass through JSON.
 */
// oxlint-disable-next-line complexity -- Explicit legacy-to-SDK mappings remain exhaustive in one place.
export const analyticsClientModule = (adapters: AnalyticsAdapter[]): string => {
  const imports: string[] = [];
  const entries: string[] = [];
  const pageviews: string[] = [];
  let vercel = false;
  const add = (
    subpath: string,
    name: string,
    options: Record<string, JsonValue | undefined>,
    attributes?: Record<string, string>
  ) => {
    const alias = `sdk${entries.length}`;
    imports.push(
      `import { ${name} as ${alias} } from "blume/integrations/${subpath}";`
    );
    const expression = `${alias}(${JSON.stringify(options)})`;
    entries.push(
      `withAttributes(${expression}, ${JSON.stringify(attributes ?? {})}, "blume-sdk-${entries.length}")`
    );
  };
  for (const adapter of adapters) {
    switch (adapter.kind) {
      case "adobe": {
        add("adobe-analytics", "adobeAnalytics", {
          scriptUrl: adapter.options.url,
        });
        break;
      }
      case "amplitude": {
        const { key, ...initOptions } = adapter.options;
        add("amplitude", "amplitude", {
          apiKey: key,
          initOptions: {
            autocapture: true,
            fetchRemoteConfig: true,
            ...initOptions,
          },
        });
        break;
      }
      case "clarity": {
        add("microsoft-clarity", "clarity", adapter.options);
        break;
      }
      case "clearbit": {
        add("clearbit", "clearbit", { publishableKey: adapter.options.key });
        break;
      }
      case "cloudflare": {
        add(
          "cloudflare-web-analytics",
          "cloudflareWebAnalytics",
          adapter.options
        );
        break;
      }
      case "databuddy": {
        const { clientId, ...settings } = adapter.options;
        add(
          "databuddy",
          "databuddy",
          {
            clientId,
            configWhenDenied: { disabled: true },
            configWhenGranted: { disabled: false },
          },
          attrs(settings)
        );
        break;
      }
      case "fathom": {
        const { site, ...settings } = adapter.options;
        add(
          "fathom-analytics",
          "fathomAnalytics",
          { site, spa: "auto" },
          attrs(settings)
        );
        break;
      }
      case "google-analytics": {
        const { id, ...config } = adapter.options;
        add("google-tag", "gtag", { category: "measurement", config, id });
        break;
      }
      case "google-tag-manager": {
        add("google-tag-manager", "googleTagManager", adapter.options);
        break;
      }
      case "heap": {
        const { id, ...clientConfig } = adapter.options;
        add("heap", "heap", { clientConfig, envId: id });
        break;
      }
      case "hightouch": {
        const { key, host } = adapter.options;
        add("hightouch", "hightouch", { apiHost: host, writeKey: key });
        pageviews.push("hightouch");
        break;
      }
      case "hotjar": {
        add("hotjar", "hotjar", {
          siteId: adapter.options.id,
          version: adapter.options.version,
        });
        break;
      }
      case "logrocket": {
        const { id, ...initOptions } = adapter.options;
        add("logrocket", "logRocket", { appId: id, initOptions });
        break;
      }
      case "mixpanel": {
        const { token, region = "us", ...init } = adapter.options;
        add("mixpanel-analytics", "mixpanelAnalytics", {
          initOptions: {
            api_host: {
              eu: "https://api-eu.mixpanel.com",
              in: "https://api-in.mixpanel.com",
              us: "https://api-js.mixpanel.com",
            }[region],
            track_pageview: "url-with-path-and-query-string",
            ...init,
          },
          token,
        });
        break;
      }
      case "one-dollar-stats": {
        add("one-dollar-stats", "oneDollarStats", adapter.options);
        break;
      }
      case "pirsch": {
        const { code, ...settings } = adapter.options;
        add("pirsch", "pirsch", { identificationCode: code }, attrs(settings));
        break;
      }
      case "plausible": {
        const {
          domain,
          host = "https://plausible.io",
          ...settings
        } = adapter.options;
        add(
          "plausible-analytics",
          "plausibleAnalytics",
          { domain, scriptUrl: `${host.replace(/\/+$/u, "")}/js/script.js` },
          attrs(settings)
        );
        break;
      }
      case "posthog": {
        const {
          key,
          host = "https://us.i.posthog.com",
          ...init
        } = adapter.options;
        add("posthog", "posthog", {
          apiHost: host,
          id: key,
          initOptions: { defaults: "unset", ...init },
        });
        if (
          init.capture_pageview !== false &&
          init.capture_pageview !== "history_change" &&
          (init.capture_pageview !== undefined ||
            init.defaults === undefined ||
            init.defaults === "unset")
        ) {
          pageviews.push("posthog");
        }
        break;
      }
      case "segment": {
        const {
          key,
          cdn = "https://cdn.segment.com",
          ...loadOptions
        } = adapter.options;
        add("segment", "segment", {
          loadOptions,
          scriptUrl: `${cdn.replace(/\/+$/u, "")}/analytics.js/v1/${encodeURIComponent(key)}/analytics.min.js`,
          writeKey: key,
        });
        pageviews.push("segment");
        break;
      }
      case "vercel": {
        if (vercel) {
          break;
        }
        vercel = true;
        const { scriptSrc, ...options } = adapter.options;
        add("vercel-analytics", "vercelAnalytics", {
          ...options,
          scriptUrl:
            scriptSrc ??
            (options.debug === true || options.mode === "development"
              ? undefined
              : "/_vercel/insights/script.js"),
        });
        break;
      }
      case "script": {
        entries.push(
          JSON.stringify({
            ...adapter.options,
            category: "measurement",
            id: `blume-custom-${entries.length}`,
            textContent: adapter.options.content,
          })
        );
        break;
      }
      default: {
        const unreachable: never = adapter;
        throw new Error(
          `Unknown analytics adapter: ${JSON.stringify(unreachable)}`
        );
      }
    }
  }
  return `${imports.join("\n")}
const withAttributes = (script, attributes, id) => ({ ...script, id, attributes: { ...script.attributes, ...attributes } });
export const scripts = [${entries.join(",\n")}];
export const pageviews = ${JSON.stringify(pageviews)};`;
};
