import { getConsentClient } from "@c15t/astro/client";
import type { ConsentState, Script } from "@c15t/core";
import type { ConsentRuntimeOptions } from "@c15t/core/runtime";
import { createEventDispatcher } from "@c15t/scripts/events";

import type { ConsentAdapter } from "./schema.ts";

/** Read-only compatibility state used by Blume feedback controls. */
export interface BlumeConsent {
  analytics: boolean | null;
  kind: string;
  open?: () => void;
}

interface ProviderWindow extends Window {
  Osano?: {
    cm?: {
      [property: string]: boolean | undefined | ((...args: never[]) => void);
      addEventListener: (name: string, fn: () => void) => void;
      removeEventListener?: (name: string, fn: () => void) => void;
      showDrawer: () => void;
    };
  };
  Fides?: {
    consent?: Record<
      string,
      boolean | "opt_in" | "opt_out" | "acknowledge" | null
    >;
    showModal: () => void;
  };
  blumeConsent?: BlumeConsent;
  __blumeTrack?: (
    event: string,
    props: Record<string, boolean | number | string>
  ) => void;
}

/** External CMP decisions are consumed without writing c15t choice receipts. */
export const externalConsentSource = (
  adapter: ConsentAdapter
): ConsentRuntimeOptions["consentSource"] => {
  if (
    typeof window === "undefined" ||
    (adapter.kind !== "osano" && adapter.kind !== "ethyca")
  ) {
    return;
  }
  // SAFETY: All added globals are optional and are checked before use.
  const w = window as ProviderWindow;
  if (adapter.kind === "osano") {
    return {
      getPermissions: () => {
        const permissions: Partial<ConsentState> = {};
        const provider = w.Osano?.cm;
        for (const [category, property] of Object.entries({
          measurement: "analytics",
          ...adapter.options.categories,
        })) {
          Reflect.set(
            permissions,
            category,
            Boolean(provider && property && provider[property] === true)
          );
        }
        return permissions;
      },
      openPreferences: () => w.Osano?.cm?.showDrawer(),
      subscribe: (listener) => {
        const provider = w.Osano?.cm;
        const events = [
          "osano-cm-initialized",
          "osano-cm-consent-saved",
          "osano-cm-consent-changed",
        ];
        for (const event of events) {
          provider?.addEventListener(event, listener);
        }
        return () => {
          for (const event of events) {
            provider?.removeEventListener?.(event, listener);
          }
        };
      },
    };
  }
  const notice = adapter.options.notice ?? "analytics";
  return {
    getPermissions: () => {
      const permissions: Partial<ConsentState> = {};
      for (const [category, property] of Object.entries({
        measurement: notice,
        ...adapter.options.categories,
      })) {
        const value = property ? w.Fides?.consent?.[property] : undefined;
        Reflect.set(
          permissions,
          category,
          value === true || value === "opt_in" || value === "acknowledge"
        );
      }
      return permissions;
    },
    openPreferences: () => w.Fides?.showModal(),
    subscribe: (listener) => {
      w.addEventListener("FidesReady", listener);
      w.addEventListener("FidesUpdated", listener);
      return () => {
        w.removeEventListener("FidesReady", listener);
        w.removeEventListener("FidesUpdated", listener);
      };
    },
  };
};

/** Connect Blume UI/events to the already-booted, page-wide c15t runtime. */
export const startConsentRuntime = (
  scripts: Script[] = [],
  pageviews: string[] = []
): (() => void) => {
  const client = getConsentClient();
  if (!client || typeof window === "undefined") {
    return () => {
      /* No runtime was mounted. */
    };
  }
  // SAFETY: All added globals are optional and are checked before use.
  const w = window as ProviderWindow;
  const dispatcher = createEventDispatcher({
    getSnapshot: client.getConsent,
    pageviews,
    scripts,
  });
  w.__blumeTrack = dispatcher.track;
  const sync = () => {
    const analytics = client.getConsent().effectivePermissions.measurement;
    const previous = w.blumeConsent?.analytics;
    w.blumeConsent = {
      analytics,
      kind: "c15t",
      open: () => {
        void client.openDialog();
      },
    };
    if (previous !== analytics) {
      w.dispatchEvent(
        new CustomEvent("blume:consent", { detail: { analytics } })
      );
    }
  };
  const syncPresentation = () => {
    document.documentElement.classList.toggle(
      "c15t-dark",
      document.documentElement.dataset.theme === "dark"
    );
    const language = document.documentElement.lang;
    if (language && client.getConsent().translations?.language !== language) {
      client.runtime.kernel.set.language(language);
    }
  };
  syncPresentation();
  const observer = new MutationObserver(syncPresentation);
  observer.observe(document.documentElement, {
    attributeFilter: ["data-theme", "lang"],
    attributes: true,
  });
  sync();
  const unsubscribe = client.subscribe(sync);
  const onClick = (event: MouseEvent) => {
    if (
      event.target instanceof Element &&
      event.target.closest("[data-blume-consent-open]")
    ) {
      event.preventDefault();
      void client.openDialog();
    }
  };
  const onPageLoad = () => {
    syncPresentation();
    dispatcher.pageview(location.pathname + location.search);
  };
  dispatcher.pageview(location.pathname + location.search);
  document.addEventListener("click", onClick);
  document.addEventListener("astro:page-load", onPageLoad);
  return () => {
    unsubscribe();
    observer.disconnect();
    document.removeEventListener("click", onClick);
    document.removeEventListener("astro:page-load", onPageLoad);
    delete w.__blumeTrack;
  };
};
