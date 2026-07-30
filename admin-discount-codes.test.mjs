import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin tracks referral associations and generates expiring one-time discount codes", async () => {
  const [adminHtml, adminScript, server] = await Promise.all([
    readFile("admin.html", "utf8"),
    readFile("admin.js", "utf8"),
    readFile("server.js", "utf8"),
  ]);

  assert.match(adminHtml, /data-admin-tab="discounts"/);
  assert.match(adminHtml, /name="customerName"[^>]*required/);
  assert.match(adminHtml, /name="referralName"/);
  assert.match(adminHtml, /data-admin-discount-codes/);
  assert.match(adminScript, /\/api\/admin\/discount-codes/);
  assert.match(adminScript, /Codice \$\{discountCode\.code\} creato: scade tra 24 ore/);
  assert.match(server, /async function handleAdminDiscountCodes/);
  assert.match(server, /customerName: cleanTrackingString\(record\?\.customerName/);
  assert.match(server, /referralName: cleanTrackingString\(record\?\.referralName/);
  assert.match(server, /source: "admin"/);
  assert.match(server, /expiresAt: new Date\(now\.getTime\(\) \+ referralCodeOrderExpiryMs\)/);
});
