import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import type {
  BlumeConsent,
  ConsentState,
} from "../src/components/layout/consent/types.ts";

// `c15t()`'s browser module against a fake c15t client and a minimal DOM:
// the root element's class list, `data-theme` and `lang`, document listeners,
// and a MutationObserver the test fires by hand.

interface FakeSnapshot {
  effectivePermissions: { measurement: boolean };
  translations?: { language: string };
}

/** The root element's `dataset`: Blume's theme, which a test may unset. */
interface FakeDataset {
  theme?: string;
}

/** The page-wide c15t client, as much of it as the module uses. */
const fakeClient = () => {
  let snapshot: FakeSnapshot = {
    effectivePermissions: { measurement: false },
    translations: { language: "en" },
  };
  const listeners = new Set<(next: FakeSnapshot) => void>();
  const client = {
    allow: (measurement: boolean) => {
      snapshot = { ...snapshot, effectivePermissions: { measurement } };
      for (const listener of listeners) {
        listener(snapshot);
      }
    },
    getConsent: () => snapshot,
    languages: new Array<string>(),
    openDialog: () => {
      client.opened += 1;
      return Promise.resolve();
    },
    opened: 0,
    runtime: {
      kernel: {
        set: {
          language: (language: string) => {
            client.languages.push(language);
            snapshot = { ...snapshot, translations: { language } };
          },
        },
      },
    },
    subscribe: (listener: (next: FakeSnapshot) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return client;
};

/** What `getConsentClient()` returns: the booted client, or none yet. */
interface C15tGlobal {
  client: ReturnType<typeof fakeClient> | null;
}

const c15t: C15tGlobal = { client: null };

mock.module("@c15t/astro/client", () => ({
  getConsentClient: () => c15t.client,
}));

const { start } = await import("../src/components/layout/consent/c15t.ts");

const page = () => {
  const classes = new Set<string>();
  const listeners = new Map<string, (() => void)[]>();
  const observers: (() => void)[] = [];
  const dataset: FakeDataset = { theme: "light" };
  const root = {
    classList: {
      contains: (name: string) => classes.has(name),
      toggle: (name: string, on: boolean) => {
        if (on) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      },
    },
    dataset,
    lang: "en",
  };
  Object.assign(globalThis, {
    MutationObserver: function MutationObserver(onMutate: () => void) {
      return {
        observe: () => {
          observers.push(onMutate);
        },
      };
    },
    document: {
      addEventListener: (type: string, listener: () => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      documentElement: root,
    },
  });
  const fire = (type: string) => {
    for (const listener of listeners.get(type) ?? []) {
      listener();
    }
  };
  const mutate = () => {
    for (const observer of observers) {
      observer();
    }
  };
  return { classes, fire, listeners, mutate, root };
};

const consentState = () => {
  const reports: boolean[] = [];
  const consent: BlumeConsent = {
    analytics: null,
    kind: "c15t",
    set: ({ analytics }: ConsentState) => {
      reports.push(analytics);
      consent.analytics = analytics;
    },
  };
  return { consent, reports };
};

describe("c15t()'s browser module", () => {
  beforeEach(() => {
    c15t.client = fakeClient();
  });

  afterEach(() => {
    c15t.client = null;
    for (const name of ["MutationObserver", "document"]) {
      Reflect.deleteProperty(globalThis, name);
    }
  });

  it("reports c15t's measurement permission as the analytics answer", () => {
    page();
    const { consent, reports } = consentState();
    start(consent, {});
    expect(reports).toEqual([false]);
    c15t.client?.allow(true);
    expect(consent.analytics).toBe(true);
    c15t.client?.allow(false);
    expect(reports).toEqual([false, true, false]);
  });

  it("opens c15t's dialog from the Cookie settings link", () => {
    page();
    const { consent } = consentState();
    start(consent, {});
    consent.open?.();
    expect(c15t.client?.opened).toBe(1);
  });

  it("keeps c15t's dark class and language on the site's", () => {
    const { classes, fire, mutate, root } = page();
    root.dataset.theme = "dark";
    root.lang = "de";
    start(consentState().consent, {});
    expect(classes.has("c15t-dark")).toBe(true);
    expect(c15t.client?.languages).toEqual(["de"]);

    root.dataset.theme = "light";
    mutate();
    expect(classes.has("c15t-dark")).toBe(false);

    // A swap brings a class list without `c15t-dark`; the theme is dark.
    root.dataset.theme = "dark";
    fire("astro:after-swap");
    expect(classes.has("c15t-dark")).toBe(true);
    expect(c15t.client?.languages).toEqual(["de"]);

    root.lang = "";
    mutate();
    expect(c15t.client?.languages).toEqual(["de"]);
  });

  it("waits for c15t to boot when its script runs after this one", () => {
    const { fire } = page();
    const booted = c15t.client;
    c15t.client = null;
    const { consent, reports } = consentState();
    start(consent, {});
    expect(reports).toEqual([]);
    c15t.client = booted;
    fire("DOMContentLoaded");
    expect(reports).toEqual([false]);
  });

  it("holds analytics if c15t never boots", () => {
    const { fire } = page();
    c15t.client = null;
    const { consent, reports } = consentState();
    start(consent, {});
    fire("DOMContentLoaded");
    expect(reports).toEqual([]);
    expect(consent.open).toBeUndefined();
  });
});
