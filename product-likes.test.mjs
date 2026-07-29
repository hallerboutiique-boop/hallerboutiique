import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanLikeProductId,
  normalizeProductLikes,
  setProductLike,
  summarizeProductLikes,
} from "./product-likes.mjs";

const visitorA = "a".repeat(64);
const visitorB = "b".repeat(64);

test("stores one like per visitor and keeps the public total", () => {
  const first = setProductLike({}, "t-shirt-gucci", visitorA, true);
  const repeated = setProductLike(first.store, "t-shirt-gucci", visitorA, true);
  const secondVisitor = setProductLike(repeated.store, "t-shirt-gucci", visitorB, true);

  assert.equal(first.count, 1);
  assert.equal(repeated.count, 1);
  assert.equal(secondVisitor.count, 2);
  assert.deepEqual(summarizeProductLikes(secondVisitor.store, visitorA), {
    counts: { "t-shirt-gucci": 2 },
    likedProductIds: ["t-shirt-gucci"],
  });
});

test("removes a visitor like without affecting other visitors", () => {
  const twoLikes = setProductLike(
    setProductLike({}, "t-shirt-gucci", visitorA, true).store,
    "t-shirt-gucci",
    visitorB,
    true
  );
  const removed = setProductLike(twoLikes.store, "t-shirt-gucci", visitorA, false);

  assert.equal(removed.count, 1);
  assert.equal(removed.liked, false);
  assert.deepEqual(summarizeProductLikes(removed.store, visitorB), {
    counts: { "t-shirt-gucci": 1 },
    likedProductIds: ["t-shirt-gucci"],
  });
});

test("sanitizes malformed stored data and filters unavailable products", () => {
  const normalized = normalizeProductLikes({
    products: {
      "__proto__": [visitorA],
      valid_product: [visitorA, visitorA, "invalid"],
      removed_product: [visitorB],
    },
  });
  assert.deepEqual(normalized, {
    products: {
      valid_product: [visitorA],
      removed_product: [visitorB],
    },
  });
  assert.deepEqual(
    summarizeProductLikes(normalized, visitorA, new Set(["valid_product"])),
    { counts: { valid_product: 1 }, likedProductIds: ["valid_product"] }
  );
  assert.equal(cleanLikeProductId("../products"), "");
});
