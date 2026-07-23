import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  createTryOnReferenceSheet,
  normalizeTryOnCustomerImage,
  normalizeTryOnProductImage,
} from "./try-on-image.mjs";

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

test("try-on reference sheets preserve every supplied catalog view within API limits", async () => {
  const colors = [
    { r: 220, g: 30, b: 30 },
    { r: 30, g: 180, b: 70 },
    { r: 30, g: 80, b: 220 },
  ];
  const images = await Promise.all(colors.map(async (background, index) => ({
    data: await sharp({
      create: { width: 1200, height: 900, channels: 3, background },
    }).jpeg().toBuffer(),
    mime: "image/jpeg",
    filename: `view-${index + 1}.jpg`,
  })));
  const result = await createTryOnReferenceSheet(images, 2);
  const metadata = await sharp(result.data).metadata();

  assert.equal(result.mime, "image/jpeg");
  assert.equal(result.filename, "product-reference-sheet-3.jpg");
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 2048);
});
