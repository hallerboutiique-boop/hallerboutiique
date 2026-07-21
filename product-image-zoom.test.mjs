import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { createMatchingProductZoomImage } from "./product-image-zoom.mjs";

test("zoom image preserves the exact published crop and resolution", async () => {
  const published = await sharp({
    create: { width: 140, height: 160, channels: 3, background: "#8d6e63" },
  }).png().toBuffer();

  const result = await createMatchingProductZoomImage(published);
  assert.equal(result.width, 140);
  assert.equal(result.height, 160);
  assert.equal(result.type, "image/jpeg");
});
