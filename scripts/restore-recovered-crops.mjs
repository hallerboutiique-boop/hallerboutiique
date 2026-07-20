import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

sharp.cache(false);
sharp.concurrency(1);

const dataDir = process.env.DATA_DIR || "/data";
const productsFile = path.join(dataDir, "products.json");
const bucket = String(process.env.BUCKET_NAME || "").trim();
const endpoint = String(process.env.AWS_ENDPOINT_URL_S3 || "https://t3.storage.dev").trim();
const region = String(process.env.AWS_REGION || "auto").trim();
const publicBase = String(process.env.TIGRIS_PUBLIC_URL || `https://${bucket}.t3.tigrisfiles.io`).replace(/\/+$/, "");
const ids = [
  "louis-vuitton-skate-black-white",
  "alexander-mcqueen-black-laces",
  "alexander-mcqueen-classic-white",
  "alexander-mcqueen-sky-blue",
  "alexander-mcqueen-grey-white",
  "air-jordan",
  "alexander-mcqueen-classic-white-2",
  "alexander-mcqueen-classic-2",
];
const widths = [480, 720, 1080, 1440];

if (!bucket) throw new Error("BUCKET_NAME non configurato.");

const storage = new S3Client({ endpoint, region });

function slug(value) {
  return String(value || "prodotto")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "prodotto";
}

async function readData() {
  return JSON.parse(await fs.readFile(productsFile, "utf8"));
}

async function writeData(data) {
  const temporary = `${productsFile}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(temporary, productsFile);
}

async function upload(key, body) {
  await storage.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentLength: body.length,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
    ContentDisposition: "inline",
  }));
  return `${publicBase}/${key}`;
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Download ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function createCrop(source) {
  return sharp(source, { failOn: "none" })
    .rotate()
    .resize({ width: 1453, height: 1600, fit: "cover", position: "center", withoutEnlargement: true })
    .webp({ quality: 98, alphaQuality: 100, smartSubsample: true, effort: 2 })
    .toBuffer();
}

async function createRenditions(id, fingerprint, crop) {
  const renditions = [];
  for (const width of widths) {
    const output = await sharp(crop, { failOn: "none" })
      .resize({ width, withoutEnlargement: true, fit: "inside" })
      .webp({ quality: 95, alphaQuality: 100, smartSubsample: true, effort: 1 })
      .toBuffer({ resolveWithObject: true });
    const key = `products/restored-crops/${slug(id)}/${fingerprint}-${output.info.width}w.webp`;
    const url = await upload(key, output.data);
    renditions.push({
      url,
      width: output.info.width,
      height: output.info.height,
      type: "image/webp",
    });
  }
  return renditions;
}

const backup = `${productsFile}.bak-crop-restore-${new Date().toISOString().replace(/[:.]/g, "-")}`;
await fs.copyFile(productsFile, backup);
console.log(JSON.stringify({ state: "backup", file: backup }));

for (const id of ids) {
  const snapshot = await readData();
  const product = snapshot.items?.[id];
  if (!product) {
    console.log(JSON.stringify({ id, state: "skipped", reason: "missing product" }));
    continue;
  }
  if (product.imageVariant === "cropped"
    && Array.isArray(product.images)
    && product.images.length
    && product.images.every((image) => String(image).includes("/products/restored-crops/"))) {
    console.log(JSON.stringify({ id, state: "skipped", reason: "already restored" }));
    continue;
  }

  const originals = Array.isArray(product.originalImages) ? product.originalImages.filter(Boolean) : [];
  if (!originals.length) {
    console.log(JSON.stringify({ id, state: "skipped", reason: "missing originals" }));
    continue;
  }

  const images = [];
  const imageRenditions = {};
  for (let index = 0; index < originals.length; index += 1) {
    const source = await download(originals[index]);
    const fingerprint = createHash("sha256")
      .update(source)
      .update("restore-center-crop-10x11-v1")
      .digest("hex")
      .slice(0, 16);
    const crop = await createCrop(source);
    const cropKey = `products/restored-crops/${slug(id)}/${String(index + 1).padStart(2, "0")}-${fingerprint}-crop.webp`;
    const cropUrl = await upload(cropKey, crop);
    images.push(cropUrl);
    imageRenditions[cropUrl] = await createRenditions(id, fingerprint, crop);
    console.log(JSON.stringify({ id, image: index + 1, total: originals.length, state: "uploaded" }));
  }

  const latest = await readData();
  const current = latest.items?.[id];
  if (!current) throw new Error(`Prodotto scomparso durante il ripristino: ${id}`);
  latest.items[id] = {
    ...current,
    images,
    originalImages: originals,
    imageVariant: "cropped",
    imageRenditions,
    updatedAt: new Date().toISOString(),
  };
  latest.updatedAt = new Date().toISOString();
  await writeData(latest);
  console.log(JSON.stringify({ id, state: "completed", images: images.length }));
}

console.log(JSON.stringify({ state: "complete", products: ids.length }));
