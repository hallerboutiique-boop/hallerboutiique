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
