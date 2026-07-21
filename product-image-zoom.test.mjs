import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { createLessZoomedProductImage } from "./product-image-zoom.mjs";

test("zoom crop keeps the storefront ratio while using the maximum original area", async () => {
  const original = await sharp({
    create: { width: 300, height: 400, channels: 3, background: "#8d6e63" },
  }).jpeg({ quality: 95 }).toBuffer();
  const published = await sharp({
    create: { width: 140, height: 160, channels: 3, background: "#8d6e63" },
  }).png().toBuffer();

  const result = await createLessZoomedProductImage(published, original);
  assert.equal(result.width, 300);
  assert.equal(result.height, 343);
  assert.ok(result.width > 140);
  assert.ok(result.height > 160);
  assert.equal(result.type, "image/jpeg");
});
