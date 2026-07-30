import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Aurora checkout actions are validated server-side and applied client-side", async () => {
  const [server, script, checkout] = await Promise.all([
    readFile("server.js", "utf8"),
    readFile("script.js", "utf8"),
    readFile("checkout.html", "utf8"),
  ]);

  assert.match(server, /import \{ normalizeAuroraCheckoutAction \} from "\.\/chat-checkout\.mjs"/);
  assert.match(server, /const auroraCheckoutResponseSchema/);
  assert.match(server, /const currentCheckoutItems = cleanChatCheckoutItems\(body\.checkout\?\.items, catalog\)/);
  assert.match(server, /const checkout = normalizeAuroraCheckoutAction\(response\.checkout, catalog\)/);
  assert.match(server, /const discountCode = await usableChatDiscountCode\(response\.checkout\?\.discountCode\)/);
  assert.match(server, /const discountApplicationRequested = isDiscountApplicationRequest\(message\)/);
  assert.match(server, /const code = await usableChatDiscountCodeFromMessages\(\[/);
  assert.match(server, /const referralFollowUpPending = history/);
  assert.match(server, /extractStandaloneReferralName\(message\)/);
  assert.match(server, /if \(isTenPercentDiscountRequest\(message\) \|\| referralFollowUpPending\) \{/);
  assert.doesNotMatch(server, /isTenPercentDiscountRequest\(message\) && !chatDiscountApplicationRequested\(message\)/);
  assert.match(server, /reply: siteChatDiscountMessages\[language\]\.applied\.replace\("\{code\}", code\)/);
  assert.match(server, /checkout: \{ mode: "unchanged", items: \[\], discountCode: code \}/);
  assert.match(script, /function auroraCheckoutState\(\)/);
  assert.match(script, /function replaceCheckoutItems\(items\)/);
  assert.match(script, /async function applyCheckoutDiscountCode\(/);
  assert.match(script, /async function applyAuroraCheckoutAction\(checkout\)/);
  assert.match(script, /checkout: auroraCheckoutState\(\)/);
  assert.match(script, /const checkoutUpdated = await applyAuroraCheckoutAction\(data\.checkout\)/);
  assert.match(script, /const checkoutDiscountCodeKey = "hallerBoutiqueCheckoutDiscountCode"/);
  assert.match(checkout, /\/assets-v\/aurora-audio-2\/script\.js/);
});
