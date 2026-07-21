import sharp from "sharp";

function orientedDimensions(metadata) {
  const orientation = Number(metadata?.orientation || 1);
  const width = Number(metadata?.width || 0);
  const height = Number(metadata?.height || 0);
  if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) {
    throw new Error("Dimensioni immagine non disponibili.");
  }
  return orientation >= 5 && orientation <= 8
    ? { width: height, height: width }
    : { width, height };
}

export async function createMatchingProductZoomImage(publishedImage) {
  const publishedMetadata = await sharp(publishedImage, { failOn: "none" }).metadata();
  const published = orientedDimensions(publishedMetadata);
  const output = await sharp(publishedImage, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .sharpen(0.35)
    .jpeg({
      quality: 95,
      chromaSubsampling: "4:4:4",
      mozjpeg: false,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    data: output.data,
    width: published.width,
    height: published.height,
    type: "image/jpeg",
  };
}
