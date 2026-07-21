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

export async function createLessZoomedProductImage(publishedImage, originalImage) {
  const [publishedMetadata, originalMetadata] = await Promise.all([
    sharp(publishedImage, { failOn: "none" }).metadata(),
    sharp(originalImage, { failOn: "none" }).metadata(),
  ]);
  const published = orientedDimensions(publishedMetadata);
  const original = orientedDimensions(originalMetadata);
  const targetAspectRatio = published.width / published.height;
  const originalAspectRatio = original.width / original.height;

  let width = original.width;
  let height = original.height;
  if (originalAspectRatio > targetAspectRatio) {
    width = Math.max(1, Math.min(original.width, Math.round(original.height * targetAspectRatio)));
  } else if (originalAspectRatio < targetAspectRatio) {
    height = Math.max(1, Math.min(original.height, Math.round(original.width / targetAspectRatio)));
  }

  const left = Math.max(0, Math.floor((original.width - width) / 2));
  const top = Math.max(0, Math.floor((original.height - height) / 2));
  let pipeline = sharp(originalImage, { failOn: "none" }).rotate();
  if (width !== original.width || height !== original.height) {
    pipeline = pipeline.extract({ left, top, width, height });
  }

  const output = await pipeline
    .sharpen(0.35)
    .webp({
      quality: 98,
      alphaQuality: 100,
      smartSubsample: true,
      effort: 4,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    data: output.data,
    width: output.info.width,
    height: output.info.height,
    type: "image/webp",
  };
}
