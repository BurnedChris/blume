import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

// The docs app's e2e dependency brings Chromium; no separate install needed.
const require = createRequire(
  path.resolve(import.meta.dirname, "../apps/docs/package.json")
);
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://www.googletagmanager.com/**", (route) =>
  route.fulfill({
    body: "window.__gtmLoaded=(window.__gtmLoaded||0)+1;",
    contentType: "application/javascript",
  })
);
await page.goto(process.argv[2] ?? "http://127.0.0.1:4317/", {
  waitUntil: "networkidle",
});
await page
  .locator('[data-testid="consent-banner-root"]')
  .waitFor({ state: "visible" });
assert.equal(
  await page.evaluate(
    () => window.__c15tAstro.getConsent().effectivePermissions.measurement
  ),
  false
);
await page.evaluate(() => window.__blumeTrack("blocked", { count: 1 }));
assert.equal(
  await page.evaluate(() =>
    window.dataLayer.some((e) => e.event === "blocked")
  ),
  false
);
await page.locator('[data-c15t-action="accept"]').click();
await page.waitForFunction(
  () => window.__c15tAstro.getConsent().effectivePermissions.measurement
);
await page.evaluate(() => {
  window.__runtimeReference = window.__c15tAstro;
  window.__blumeTrack("allowed", { count: 2 });
});
assert.equal(
  await page.evaluate(
    () => window.dataLayer.filter((e) => e.event === "allowed").length
  ),
  1
);
// The reader's theme choice, not the OS, drives c15t's dark palette, and
// survives a ClientRouter swap.
await page.emulateMedia({ colorScheme: "light" });
await page.locator("[data-blume-theme-toggle]").first().click();
await page.locator('a[href="/next"]').first().click();
await page.waitForURL("**/next/");
await page.waitForFunction(() =>
  document.documentElement.classList.contains("c15t-dark")
);
assert.equal(
  await page.evaluate(() => window.__c15tAstro === window.__runtimeReference),
  true
);
assert.equal(await page.evaluate(() => window.__gtmLoaded), 1);
await page.locator("[data-blume-consent-open]").first().click();
await page.getByRole("dialog").waitFor({ state: "visible" });
const card = page.locator('[data-testid="consent-dialog-card"]');
const cardStyle = () =>
  card.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, radius: style.borderRadius };
  });
// Unstyled, the dialog has no radius and a transparent background.
const darkCard = await cardStyle();
assert.notEqual(darkCard.radius, "0px");
assert.notEqual(darkCard.background, "rgba(0, 0, 0, 0)");
// The modal blocks pointer input to the header, so toggle it directly.
await page.evaluate(() =>
  document.querySelector("[data-blume-theme-toggle]")?.click()
);
await page.emulateMedia({ colorScheme: "dark" });
const lightCard = await cardStyle();
assert.notEqual(lightCard.background, darkCard.background);
assert.equal(
  await page.evaluate(() =>
    document.documentElement.classList.contains("c15t-dark")
  ),
  false
);
const reloaded = page.waitForEvent("load");
await page.evaluate(() => window.__c15tAstro.rejectAll());
await reloaded;
await page.waitForFunction(() => !!window.__c15tAstro);
assert.equal(
  await page.evaluate(
    () => window.__c15tAstro.getConsent().effectivePermissions.measurement
  ),
  false
);
assert.deepEqual(errors, []);
console.log(
  "PASS: denied defaults, event suppression, accept, single runtime across navigation, styled preferences following the site theme, withdrawal/reload"
);
await browser.close();
