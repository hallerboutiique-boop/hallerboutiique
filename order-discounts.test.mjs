import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticDiscountPercentage,
  calculateOrderDiscounts,
  discountCodeIsUsable,
  extractReferralName,
  extractStandaloneReferralName,
  findUsableDiscountCodeInMessages,
  isDiscountApplicationRequest,
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
  assert.equal(extractStandaloneReferralName("mario rossi"), "Mario Rossi");
  assert.equal(extractStandaloneReferralName("Il mio amico è Mario Rossi"), "");
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

test("recognizes discount application requests and reuses Aurora's latest usable code", () => {
  const now = new Date("2026-07-31T11:00:00.000Z");
  const records = [
    { status: "issued", code: "AB12CD3", expiresAt: "2026-07-31T12:00:00.000Z" },
    { status: "reserved", code: "ZZ99YY8", expiresAt: "2026-07-31T12:00:00.000Z" },
  ];

  assert.equal(isDiscountApplicationRequest("Applica il codice AB12CD3"), true);
  assert.equal(isDiscountApplicationRequest("Applicalo"), true);
  assert.equal(isDiscountApplicationRequest("Applicami il 10%"), true);
  assert.equal(isTenPercentDiscountRequest("Applicami il 10%"), true);
  assert.equal(isTenPercentDiscountRequest("Appliquer la remise de 10 %"), true);
  assert.equal(isDiscountApplicationRequest("Vorrei uno sconto"), false);
  assert.equal(findUsableDiscountCodeInMessages(records, [
    "Applicalo",
    "Perfetto: il tuo codice sconto è AB12CD3.",
  ], now), "AB12CD3");
  assert.equal(findUsableDiscountCodeInMessages(records, ["Usa ZZ99YY8"], now), "");
});
