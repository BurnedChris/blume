import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.resolve(process.argv[2], "package.json"));
const { chromium } = require("playwright");
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
await page.goto("http://127.0.0.1:4317/", { waitUntil: "networkidle" });
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
await page.locator('a[href="/next"]').first().click();
await page.waitForURL("**/next/");
assert.equal(
  await page.evaluate(() => window.__c15tAstro === window.__runtimeReference),
  true
);
assert.equal(await page.evaluate(() => window.__gtmLoaded), 1);
await page.locator("[data-blume-consent-open]").first().click();
await page.getByRole("dialog").waitFor({ state: "visible" });
console.log("dialog opened", await page.getByRole("dialog").textContent());
await page.screenshot({
  fullPage: true,
  path: "/private/tmp/blume-consent-dialog.png",
});
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
  "PASS: denied defaults, event suppression, accept, single runtime across navigation, preferences, withdrawal/reload"
);
await browser.close();
