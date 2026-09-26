// oxlint-disable max-classes-per-file -- Minimal DOM and observer doubles for the browser lifecycle test.
import { afterEach, expect, it, mock } from "bun:test";

import { createConsentKernel } from "@c15t/core";

import { c15t, ethyca, osano } from "../src/consent/index.ts";
import {
  externalConsentSource,
  startConsentRuntime,
} from "../src/consent/runtime.ts";

afterEach(() => {
  for (const name of [
    "window",
    "document",
    "MutationObserver",
    "Element",
    "location",
  ]) {
    Reflect.deleteProperty(globalThis, name);
  }
});
it("does not install an external source for SSR or c15t-owned decisions", () => {
  expect(externalConsentSource(c15t())).toBeUndefined();
  Reflect.set(globalThis, "window", new EventTarget());
  expect(externalConsentSource(c15t())).toBeUndefined();
});
it("Fides starts denied, maps configured categories, observes updates and cleans up", () => {
  const events = new EventTarget();
  const showModal = mock();
  const Fides = {
    consent: { advertising: "opt_out", analytics: false },
    showModal,
  };
  Reflect.set(events, "Fides", Fides);
  Reflect.set(globalThis, "window", events);
  const source = externalConsentSource(
    ethyca({
      categories: { marketing: "advertising" },
      privacyCenter: "https://privacy.example.com",
    })
  );
  expect(source?.getPermissions()).toEqual({
    marketing: false,
    measurement: false,
  });
  const listener = mock();
  const stop = source?.subscribe(listener);
  Fides.consent.advertising = "opt_in";
  Fides.consent.analytics = true;
  events.dispatchEvent(new Event("FidesUpdated"));
  expect(listener).toHaveBeenCalledTimes(1);
  expect(source?.getPermissions()).toEqual({
    marketing: true,
    measurement: true,
  });
  source?.openPreferences();
  expect(showModal).toHaveBeenCalledTimes(1);
  stop?.();
  events.dispatchEvent(new Event("FidesUpdated"));
  expect(listener).toHaveBeenCalledTimes(1);
});
it("Osano maps only explicit boolean grants and removes provider listeners", () => {
  const events = new EventTarget();
  const showDrawer = mock();
  const cm = {
    addEventListener: events.addEventListener.bind(events),
    analytics: true,
    marketing: false,
    removeEventListener: events.removeEventListener.bind(events),
    showDrawer,
  };
  Reflect.set(globalThis, "window", { Osano: { cm } });
  const source = externalConsentSource(
    osano({
      categories: { marketing: "marketing" },
      configId: "c",
      customerId: "a",
    })
  );
  expect(source?.getPermissions()).toEqual({
    marketing: false,
    measurement: true,
  });
  const notify = mock();
  const stop = source?.subscribe(notify);
  cm.analytics = false;
  events.dispatchEvent(new Event("osano-cm-consent-changed"));
  expect(source?.getPermissions()?.measurement).toBe(false);
  expect(notify).toHaveBeenCalledTimes(1);
  source?.openPreferences();
  expect(showDrawer).toHaveBeenCalledTimes(1);
  stop?.();
  events.dispatchEvent(new Event("osano-cm-consent-changed"));
  expect(notify).toHaveBeenCalledTimes(1);
});
it("missing external SDKs remain denied", () => {
  Reflect.set(globalThis, "window", new EventTarget());
  for (const consent of [
    osano({ configId: "c", customerId: "a" }),
    ethyca({ notice: "usage", privacyCenter: "https://privacy.example.com" }),
  ]) {
    const source = externalConsentSource(consent);
    expect(source?.getPermissions()).toEqual({ measurement: false });
    expect(() => source?.openPreferences()).not.toThrow();
    source?.subscribe(() => {
      /* Provider is unavailable. */
    })();
  }
});

it("connects preferences, theme, language and pageviews to one live c15t client and cleans up", () => {
  expect(() => startConsentRuntime()()).not.toThrow();
  const kernel = createConsentKernel({ initialExternalPermissions: {} });
  const openDialog = mock();
  const page = mock();
  const track = mock();
  const language = mock();
  const toggle = mock();
  const disconnect = mock();
  let presentationChanged = mock();
  class Observer {
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- MutationObserver uses a synchronous callback API.
    constructor(callback: () => void) {
      presentationChanged = mock(callback);
    }
    observe = mock();
    disconnect = disconnect;
  }
  class Target extends EventTarget {
    closest(selector: string) {
      return selector === "[data-blume-consent-open]" ? this : null;
    }
  }
  const root = {
    classList: { toggle },
    dataset: { theme: "dark" },
    lang: "de",
  };
  const document = new Target();
  Reflect.set(document, "documentElement", root);
  const window = new EventTarget();
  const client = {
    getConsent: kernel.getSnapshot,
    openDialog,
    runtime: { kernel: { set: { language } } },
    subscribe: kernel.subscribe,
  };
  Reflect.set(window, "__c15tAstro", client);
  Reflect.set(window, "analytics", { page, track });
  for (const [name, value] of Object.entries({
    Element: Target,
    MutationObserver: Observer,
    document,
    location: { pathname: "/first", search: "" },
    window,
  })) {
    Reflect.set(globalThis, name, value);
  }
  const changes = mock();
  window.addEventListener("blume:consent", changes);
  const stop = startConsentRuntime(
    [
      {
        callbackOnly: true,
        category: "measurement",
        id: "segment",
        vendor: "segment",
      },
    ],
    ["segment"]
  );
  expect(toggle).toHaveBeenCalledWith("c15t-dark", true);
  expect(language).toHaveBeenCalledWith("de");
  expect(changes).toHaveBeenCalledTimes(1);
  kernel.set.externalPermissions({ measurement: true });
  expect(changes).toHaveBeenCalledTimes(2);
  kernel.set.externalPermissions({ measurement: true });
  expect(changes).toHaveBeenCalledTimes(2);
  // SAFETY: startConsentRuntime above installs this compatibility property.
  (
    window as EventTarget & { blumeConsent: { open: () => void } }
  ).blumeConsent.open();
  document.dispatchEvent(new Event("click", { cancelable: true }));
  expect(openDialog).toHaveBeenCalledTimes(2);
  Reflect.set(globalThis, "location", { pathname: "/second", search: "?q=1" });
  document.dispatchEvent(new Event("astro:page-load"));
  document.dispatchEvent(new Event("astro:page-load"));
  expect(page).toHaveBeenCalledTimes(1);
  root.dataset.theme = "light";
  root.lang = "";
  presentationChanged();
  expect(toggle).toHaveBeenLastCalledWith("c15t-dark", false);
  stop();
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(Reflect.has(window, "__blumeTrack")).toBe(false);
  document.dispatchEvent(new Event("click"));
  expect(openDialog).toHaveBeenCalledTimes(2);
  kernel.dispose();
});
