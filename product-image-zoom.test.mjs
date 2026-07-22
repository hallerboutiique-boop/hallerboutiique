import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { createMatchingProductZoomImage } from "./product-image-zoom.mjs";

function patternedRgb(width, height) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      data[index] = (x * 7 + y * 3 + (x * y) % 41) % 256;
      data[index + 1] = (x * 2 + y * 11 + (x + y) % 67) % 256;
      data[index + 2] = (x * 13 + y * 5 + (x * y) % 89) % 256;
    }
  }
  return data;
}

test("zoom image extracts the published crop from the original pixels", async () => {
  const originalWidth = 400;
  const originalHeight = 500;
  const expectedCrop = { left: 71, top: 93, width: 280, height: 320 };
  const original = await sharp(patternedRgb(originalWidth, originalHeight), {
    raw: { width: originalWidth, height: originalHeight, channels: 3 },
  }).jpeg({ quality: 92 }).toBuffer();
  const published = await sharp(original)
    .extract(expectedCrop)
    .resize(140, 160)
    .webp({ quality: 94 })
    .toBuffer();

  const result = await createMatchingProductZoomImage(original, published);
  assert.ok(Math.abs(result.width - expectedCrop.width) <= 3);
  assert.ok(Math.abs(result.height - expectedCrop.height) <= 3);
  assert.ok(Math.abs(result.crop.left - expectedCrop.left) <= 2);
  assert.ok(Math.abs(result.crop.top - expectedCrop.top) <= 2);
  assert.equal(result.type, "image/jpeg");
  assert.ok(result.crop.meanDifference < 15);
});

test("zoom image uses the complete original when framing is already identical", async () => {
  const original = await sharp({
    create: { width: 140, height: 160, channels: 3, background: "#8d6e63" },
  }).jpeg({ quality: 90 }).toBuffer();
  const published = await sharp(original).png().toBuffer();

  const result = await createMatchingProductZoomImage(original, published);
  assert.deepEqual(result.crop, { left: 0, top: 0, width: 140, height: 160, meanDifference: 0 });
  assert.equal(result.width, 140);
  assert.equal(result.height, 160);
});
