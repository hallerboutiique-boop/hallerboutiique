import sharp from "sharp";

const tryOnReferenceMaxDimension = 2048;

export async function normalizeTryOnProductImage(image, index = 0) {
  if (!Buffer.isBuffer(image?.data) || image.data.length === 0) {
    throw new Error("Foto prodotto try-on non valida.");
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
    filename: `product-${index + 1}.jpg`,
  };
}
