import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeTryOnCustomerImage, normalizeTryOnProductImage } from "./try-on-image.mjs";

test("try-on product images are normalized to a compatible high-quality JPEG", async () => {
  const source = await sharp({
    create: {
      width: 3000,
      height: 2400,
      channels: 4,
      background: { r: 110, g: 70, b: 45, alpha: 0.55 },
    },
  }).png().toBuffer();

  const result = await normalizeTryOnProductImage({
    data: source,
    mime: "image/png",
    filename: "catalog-product.png",
  }, 1);
  const metadata = await sharp(result.data).metadata();

  assert.equal(result.mime, "image/jpeg");
  assert.equal(result.filename, "product-2.jpg");
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.space, "srgb");
  assert.equal(metadata.channels, 3);
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 1638);
});

test("try-on product normalization rejects empty image data", async () => {
  await assert.rejects(
    normalizeTryOnProductImage({ data: Buffer.alloc(0) }),
    /Foto prodotto try-on non valida/,
  );
});

test("try-on customer images are normalized before the API call", async () => {
  const source = await sharp({
    create: {
      width: 3200,
      height: 1800,
      channels: 4,
      background: { r: 35, g: 80, b: 140, alpha: 0.8 },
    },
  }).png().toBuffer();

  const result = await normalizeTryOnCustomerImage({
    data: source,
    mime: "image/png",
    filename: "customer.png",
  });
  const metadata = await sharp(result.data).metadata();

  assert.equal(result.mime, "image/jpeg");
  assert.equal(result.filename, "customer.jpg");
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.space, "srgb");
  assert.equal(metadata.channels, 3);
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 1152);
});
