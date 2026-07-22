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

async function decodeRgb(image, resize) {
  let pipeline = sharp(image, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb");
  if (resize) {
    pipeline = pipeline.resize(resize.width, resize.height, {
      fit: "fill",
      kernel: "lanczos3",
    });
  }
  return pipeline.raw().toBuffer({ resolveWithObject: true });
}

async function resizeRgb(image, resize) {
  return sharp(image.data, {
    raw: {
      width: image.info.width,
      height: image.info.height,
      channels: image.info.channels,
    },
  })
    .resize(resize.width, resize.height, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
}

function imageFeaturePoints(image, { step, limit }) {
  const { data, info } = image;
  const channels = info.channels;
  const points = [];
  const pixel = (x, y, channel) => data[(y * info.width + x) * channels + channel];
  const luminance = (x, y) => (
    pixel(x, y, 0) * 77 + pixel(x, y, 1) * 150 + pixel(x, y, 2) * 29
  ) >> 8;

  for (let y = 2; y < info.height - 2; y += step) {
    for (let x = 2; x < info.width - 2; x += step) {
      const index = (y * info.width + x) * channels;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const edge = Math.abs(luminance(x + 1, y) - luminance(x - 1, y))
        + Math.abs(luminance(x, y + 1) - luminance(x, y - 1));
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
      points.push({ x, y, red, green, blue, priority: edge * 3 + saturation });
    }
  }

  points.sort((left, right) => right.priority - left.priority);
  return points.slice(0, Math.min(limit, points.length));
}

function candidateScore(original, points, left, top, stopAfter = Number.POSITIVE_INFINITY) {
  const { data, info } = original;
  const channels = info.channels;
  let score = 0;
  for (const point of points) {
    const index = ((top + point.y) * info.width + left + point.x) * channels;
    score += Math.abs(data[index] - point.red)
      + Math.abs(data[index + 1] - point.green)
      + Math.abs(data[index + 2] - point.blue);
    if (score >= stopAfter) return score;
  }
  return score;
}

function positions(maximum, step) {
  if (maximum <= 0) return [0];
  const result = [];
  for (let value = 0; value <= maximum; value += step) result.push(value);
  if (result[result.length - 1] !== maximum) result.push(maximum);
  return result;
}

function bestCropCandidates(original, published, points, { step, keep = 1, areas } = {}) {
  const maxLeft = original.info.width - published.info.width;
  const maxTop = original.info.height - published.info.height;
  const searchAreas = areas?.length ? areas : [{ left: 0, right: maxLeft, top: 0, bottom: maxTop }];
  const candidates = [];
  const visited = new Set();

  for (const area of searchAreas) {
    const minLeft = Math.max(0, Math.min(maxLeft, Math.round(area.left)));
    const maxAreaLeft = Math.max(minLeft, Math.min(maxLeft, Math.round(area.right)));
    const minTop = Math.max(0, Math.min(maxTop, Math.round(area.top)));
    const maxAreaTop = Math.max(minTop, Math.min(maxTop, Math.round(area.bottom)));
    const xPositions = positions(maxAreaLeft - minLeft, step).map((value) => value + minLeft);
    const yPositions = positions(maxAreaTop - minTop, step).map((value) => value + minTop);

    for (const top of yPositions) {
      for (const left of xPositions) {
        const key = `${left}:${top}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const cutoff = candidates.length >= keep ? candidates[candidates.length - 1].score : Number.POSITIVE_INFINITY;
        const score = candidateScore(original, points, left, top, cutoff);
        if (candidates.length < keep || score < cutoff) {
          candidates.push({ left, top, score });
          candidates.sort((first, second) => first.score - second.score);
          candidates.length = Math.min(keep, candidates.length);
        }
      }
    }
  }
  return candidates;
}

function numericRange(minimum, maximum, step) {
  if (maximum <= minimum) return [minimum];
  const result = [];
  for (let value = minimum; value <= maximum; value += step) result.push(value);
  if (maximum - result[result.length - 1] > step / 10) result.push(maximum);
  return result;
}

function uniqueScales(values, minimum, maximum) {
  const seen = new Set();
  return values
    .map((value) => Math.max(minimum, Math.min(maximum, value)))
    .filter((value) => {
      const key = value.toFixed(6);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function evaluateCropScale({
  originalFull,
  original,
  published,
  publishedPreview,
  points,
  scale,
  step,
  keep = 1,
  sourceAreas,
}) {
  const templateScaleX = publishedPreview.info.width / published.width;
  const templateScaleY = publishedPreview.info.height / published.height;
  const originalPreviewSize = {
    width: Math.max(publishedPreview.info.width, Math.round(original.width * templateScaleX / scale)),
    height: Math.max(publishedPreview.info.height, Math.round(original.height * templateScaleY / scale)),
  };
  const originalPreview = await resizeRgb(originalFull, originalPreviewSize);
  const areas = sourceAreas?.map((area) => ({
    left: area.left * originalPreviewSize.width / original.width,
    right: area.right * originalPreviewSize.width / original.width,
    top: area.top * originalPreviewSize.height / original.height,
    bottom: area.bottom * originalPreviewSize.height / original.height,
  }));
  return bestCropCandidates(originalPreview, publishedPreview, points, { step, keep, areas })
    .map((candidate) => ({
      scale,
      left: candidate.left * original.width / originalPreviewSize.width,
      top: candidate.top * original.height / originalPreviewSize.height,
      score: candidate.score / Math.max(1, points.length),
    }));
}

async function locatePublishedCrop(originalImage, publishedImage, original, published) {
  if (published.width > original.width || published.height > original.height) {
    throw new Error("Il ritaglio pubblicato e piu grande della foto originale.");
  }
  if (published.width === original.width && published.height === original.height) {
    return { left: 0, top: 0, width: published.width, height: published.height, meanDifference: 0 };
  }

  const [originalFull, publishedFull] = await Promise.all([
    decodeRgb(originalImage),
    decodeRgb(publishedImage),
  ]);
  const maxScale = Math.min(original.width / published.width, original.height / published.height);
  const previewScale = Math.min(1, 240 / Math.max(published.width, published.height));
  const publishedPreviewSize = {
    width: Math.max(1, Math.round(published.width * previewScale)),
    height: Math.max(1, Math.round(published.height * previewScale)),
  };
  const publishedPreview = await resizeRgb(publishedFull, publishedPreviewSize);
  const coarsePoints = imageFeaturePoints(publishedPreview, {
    step: Math.max(2, Math.floor(Math.min(publishedPreviewSize.width, publishedPreviewSize.height) / 48)),
    limit: 420,
  });
  if (!coarsePoints.length) throw new Error("Ritaglio pubblicato non analizzabile.");

  const coarseScaleStep = Math.max(0.02, (maxScale - 1) / 32);
  const coarseScales = numericRange(1, maxScale, coarseScaleStep);
  let candidates = [];
  for (const scale of coarseScales) {
    candidates.push(...await evaluateCropScale({
      originalFull,
      original,
      published,
      publishedPreview,
      points: coarsePoints,
      scale,
      step: 4,
      keep: 2,
    }));
  }
  candidates.sort((left, right) => left.score - right.score);
  candidates = candidates.slice(0, 6);
  if (!candidates.length) throw new Error("Posizione del ritaglio non trovata.");

  const fineScaleStep = coarseScaleStep / 6;
  const fineScales = uniqueScales(candidates.slice(0, 3).flatMap((candidate) => (
    numericRange(candidate.scale - coarseScaleStep, candidate.scale + coarseScaleStep, fineScaleStep)
  )), 1, maxScale);
  const finePoints = imageFeaturePoints(publishedPreview, {
    step: Math.max(2, Math.floor(Math.min(publishedPreviewSize.width, publishedPreviewSize.height) / 78)),
    limit: 1_200,
  });
  let fineCandidates = [];
  for (const scale of fineScales) {
    fineCandidates.push(...await evaluateCropScale({
      originalFull,
      original,
      published,
      publishedPreview,
      points: finePoints,
      scale,
      step: 1,
      keep: 1,
      sourceAreas: candidates.map((candidate) => ({
        left: candidate.left - 60,
        right: candidate.left + 60,
        top: candidate.top - 60,
        bottom: candidate.top + 60,
      })),
    }));
  }
  fineCandidates.sort((left, right) => left.score - right.score);
  fineCandidates = fineCandidates.slice(0, 4);
  if (!fineCandidates.length) throw new Error("Posizione precisa del ritaglio non trovata.");

  const detailScale = Math.min(1, 720 / Math.max(published.width, published.height));
  const publishedDetail = await resizeRgb(publishedFull, {
    width: Math.max(1, Math.round(published.width * detailScale)),
    height: Math.max(1, Math.round(published.height * detailScale)),
  });
  const detailPoints = imageFeaturePoints(publishedDetail, {
    step: Math.max(3, Math.floor(Math.min(publishedDetail.info.width, publishedDetail.info.height) / 100)),
    limit: 2_200,
  });
  const detailScaleStep = fineScaleStep / 4;
  const detailScales = uniqueScales(fineCandidates.slice(0, 2).flatMap((candidate) => (
    numericRange(candidate.scale - fineScaleStep * 2, candidate.scale + fineScaleStep * 2, detailScaleStep)
  )), 1, maxScale);
  let detailCandidates = [];
  for (const scale of detailScales) {
    detailCandidates.push(...await evaluateCropScale({
      originalFull,
      original,
      published,
      publishedPreview: publishedDetail,
      points: detailPoints,
      scale,
      step: 1,
      keep: 1,
      sourceAreas: fineCandidates.map((candidate) => ({
        left: candidate.left - 28,
        right: candidate.left + 28,
        top: candidate.top - 28,
        bottom: candidate.top + 28,
      })),
    }));
  }
  detailCandidates.sort((left, right) => left.score - right.score);
  const best = detailCandidates[0] || fineCandidates[0];
  const cropWidth = Math.min(original.width, Math.max(published.width, Math.round(published.width * best.scale)));
  const cropHeight = Math.min(original.height, Math.max(published.height, Math.round(published.height * best.scale)));
  const left = Math.max(0, Math.min(original.width - cropWidth, Math.round(best.left)));
  const top = Math.max(0, Math.min(original.height - cropHeight, Math.round(best.top)));

  return {
    left,
    top,
    width: cropWidth,
    height: cropHeight,
    meanDifference: best.score / 3,
  };
}

export async function createMatchingProductZoomImage(originalImage, publishedImage) {
  const [originalMetadata, publishedMetadata] = await Promise.all([
    sharp(originalImage, { failOn: "none" }).metadata(),
    sharp(publishedImage, { failOn: "none" }).metadata(),
  ]);
  const original = orientedDimensions(originalMetadata);
  const published = orientedDimensions(publishedMetadata);
  const crop = await locatePublishedCrop(originalImage, publishedImage, original, published);
  const output = await sharp(originalImage, { failOn: "none" })
    .rotate()
    .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
    .flatten({ background: "#ffffff" })
    .jpeg({
      quality: 100,
      chromaSubsampling: "4:4:4",
      mozjpeg: false,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    data: output.data,
    width: output.info.width,
    height: output.info.height,
    type: "image/jpeg",
    crop,
  };
}
