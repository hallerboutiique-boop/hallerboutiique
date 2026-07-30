import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticDiscountPercentage,
  calculateOrderDiscounts,
  discountCodeIsUsable,
  extractReferralName,
  isTenPercentDiscountRequest,
  maximumDiscountCodePercentage,
  normalizeDiscountCode,
} from "./order-discounts.mjs";

test("applies the automatic discount only above the configured threshold", () => {
  assert.equal(calculateOrderDiscounts(399).automaticDiscount, 0);
  assert.deepEqual(calculateOrderDiscounts(400), {
    subtotal: 400,
    automaticPercentage: automaticDiscountPercentage,
    automaticDiscount: 60,
    referralPercentage: 0,
    referralDiscount: 0,
    total: 340,
  });
});

test("combines the automatic and referral discounts on the entire order", () => {
  assert.deepEqual(calculateOrderDiscounts(500, 10), {
    subtotal: 500,
    automaticPercentage: 15,
    automaticDiscount: 75,
    referralPercentage: 10,
    referralDiscount: 50,
    total: 375,
  });
});

test("caps administrator-generated discount codes at one hundred percent", () => {
  assert.deepEqual(calculateOrderDiscounts(100, 150), {
    subtotal: 100,
    automaticPercentage: 0,
    automaticDiscount: 0,
    referralPercentage: maximumDiscountCodePercentage,
    referralDiscount: 100,
    total: 0,
  });
});

test("recognizes a referral name supplied before a ten-percent request", () => {
  assert.equal(extractReferralName(["Il mio amico si chiama marco rossi.", "Vorrei il 10% di sconto."]), "Marco Rossi");
  assert.equal(isTenPercentDiscountRequest("Posso avere un codice sconto del 10%?"), true);
  assert.equal(isTenPercentDiscountRequest("Vorrei sapere le taglie."), false);
});

test("normalizes and invalidates one-time referral codes", () => {
  assert.equal(normalizeDiscountCode("ab-12 cd3"), "AB12CD3");
  const expiry = "2026-07-31T12:00:00.000Z";
  assert.equal(discountCodeIsUsable({ status: "issued", code: "AB12CD3", expiresAt: expiry }, new Date("2026-07-31T11:59:59.000Z")), true);
  assert.equal(discountCodeIsUsable({ status: "reserved", code: "AB12CD3", expiresAt: expiry }, new Date("2026-07-31T11:00:00.000Z")), false);
  assert.equal(discountCodeIsUsable({ status: "issued", code: "AB12CD3", expiresAt: expiry }, new Date("2026-07-31T12:00:00.000Z")), false);
});
