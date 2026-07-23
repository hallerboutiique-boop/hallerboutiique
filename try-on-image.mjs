import sharp from "sharp";

const tryOnReferenceMaxDimension = 2048;

async function normalizeTryOnImage(image, filename, invalidMessage = "Foto try-on non valida.") {
  if (!Buffer.isBuffer(image?.data) || image.data.length === 0) {
    throw new Error(invalidMessage);
  }

  const output = await sharp(image.data, { failOn: "error" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .resize({
      width: tryOnReferenceMaxDimension,
      height: tryOnReferenceMaxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 95,
      chromaSubsampling: "4:4:4",
      mozjpeg: false,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    data: output.data,
    mime: "image/jpeg",
    filename,
  };
}

export function normalizeTryOnProductImage(image, index = 0) {
  return normalizeTryOnImage(image, `product-${index + 1}.jpg`, "Foto prodotto try-on non valida.");
}

export function normalizeTryOnCustomerImage(image) {
  return normalizeTryOnImage(image, "customer.jpg");
}

export async function createTryOnReferenceSheet(images, sheetIndex = 0) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("Foto prodotto try-on non disponibili.");
  }
  const canvasSize = 2048;
  const gap = 24;
  const columns = Math.ceil(Math.sqrt(images.length));
  const rows = Math.ceil(images.length / columns);
  const tileWidth = Math.floor((canvasSize - gap * (columns + 1)) / columns);
  const tileHeight = Math.floor((canvasSize - gap * (rows + 1)) / rows);
  const tiles = await Promise.all(images.map(async (image, index) => ({
    input: await sharp(image.data, { failOn: "error" })
      .resize({
        width: tileWidth,
        height: tileHeight,
        fit: "contain",
        background: "#ffffff",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: false })
      .toBuffer(),
    left: gap + (index % columns) * (tileWidth + gap),
    top: gap + Math.floor(index / columns) * (tileHeight + gap),
  })));
  const data = await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 3,
      background: "#f4f4f2",
    },
  })
    .composite(tiles)
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: false })
    .toBuffer();
  return {
    data,
    mime: "image/jpeg",
    filename: `product-reference-sheet-${sheetIndex + 1}.jpg`,
  };
}
