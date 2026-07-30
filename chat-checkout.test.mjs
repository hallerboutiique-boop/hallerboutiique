import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAuroraCheckoutAction } from "./chat-checkout.mjs";

const catalog = [
  { id: "track-black", sizes: ["40", "41"], availableSizes: ["41"], isSoldOut: false },
  { id: "ace-green", sizes: [], availableSizes: [], isSoldOut: false },
  { id: "sold-out", sizes: [], availableSizes: [], isSoldOut: true },
];

test("accepts only available catalog products and sizes for Aurora checkout actions", () => {
  assert.deepEqual(normalizeAuroraCheckoutAction({
    mode: "replace",
    items: [{ id: "track-black", size: "41" }, { id: "ace-green", size: "" }],
  }, catalog), {
    mode: "replace",
    items: [{ id: "track-black", size: "41" }, { id: "ace-green", size: "" }],
  });
  assert.equal(normalizeAuroraCheckoutAction({ mode: "replace", items: [{ id: "track-black", size: "40" }] }, catalog), null);
  assert.equal(normalizeAuroraCheckoutAction({ mode: "replace", items: [{ id: "sold-out", size: "" }] }, catalog), null);
});

test("supports a deliberate cart clear without accepting unknown actions", () => {
  assert.deepEqual(normalizeAuroraCheckoutAction({ mode: "replace", items: [] }, catalog), { mode: "replace", items: [] });
  assert.deepEqual(normalizeAuroraCheckoutAction({ mode: "unchanged", items: [] }, catalog), { mode: "unchanged", items: [] });
  assert.equal(normalizeAuroraCheckoutAction({ mode: "add", items: [] }, catalog), null);
});
