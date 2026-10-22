/**
 * `c15t()`'s browser module. c15t's own integration boots the banner, the
 * dialog, and the scripts it loads; this connects that one page-wide c15t
 * client to Blume. It reports c15t's `measurement` permission as the
 * reader's analytics answer, makes the footer's Cookie settings link open
 * c15t's dialog, and keeps c15t's dark class and language on the site's.
 */
import { getConsentClient } from "@c15t/astro/client";
import type { AstroConsentClient } from "@c15t/astro/client";

import type { C15tOptions } from "../../../consent/c15t.ts";
import type { BlumeConsent, ConsentClientStart } from "./types.ts";

/**
 * Put c15t's surfaces on the site's theme and language. Blume's theme toggle
 * sets `data-theme`, and the `c15t-dark` class carries it to c15t's tokens.
 */
const syncPresentation = (client: AstroConsentClient): void => {
  const root = document.documentElement;
  root.classList.toggle("c15t-dark", root.dataset.theme === "dark");
  const language = root.lang;
  if (language && client.getConsent().translations?.language !== language) {
    client.runtime.kernel.set.language(language);
  }
};

const connect = (consent: BlumeConsent, client: AstroConsentClient): void => {
  consent.open = () => {
    void client.openDialog();
  };
  const sync = () => {
    consent.set({
      analytics: client.getConsent().effectivePermissions.measurement === true,
    });
  };
  sync();
  client.subscribe(sync);
  syncPresentation(client);
  new MutationObserver(() => {
    syncPresentation(client);
  }).observe(document.documentElement, {
    attributeFilter: ["data-theme", "lang"],
    attributes: true,
  });
  // A client-router swap brings the new page's `<html>` class list, without
  // `c15t-dark`; put it back before paint.
  document.addEventListener("astro:after-swap", () => {
    syncPresentation(client);
  });
};

/**
 * Connect to c15t's client. c15t boots from its own page script, which may
 * run after this one; both run before `DOMContentLoaded`, so wait for that
 * when the client isn't there yet. If c15t never boots, analytics stays held.
 */
export const start: ConsentClientStart<C15tOptions> = (consent) => {
  const client = getConsentClient();
  if (client) {
    connect(consent, client);
    return;
  }
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      const booted = getConsentClient();
      if (booted) {
        connect(consent, booted);
      }
    },
    { once: true }
  );
};
