import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import QRCode from "qrcode";
import {
  ORDER_STATUS,
  buildOrdersDashboard,
  buildShippingLabel,
  normalizePushSubscription,
  publicMobileOrder,
  renderShippingLabelHtml,
  sendExpoPushNotifications,
  shippingLabelQrPayload,
  transitionOrder,
} from "./mobile-admin.js";
import { createMatchingProductZoomImage } from "./product-image-zoom.mjs";
import { normalizeTryOnCustomerImage, normalizeTryOnProductImage } from "./try-on-image.mjs";
import { normalizePhotonSuggestions, validateCheckoutOrder } from "./checkout-address.mjs";
import {
  adjustProductInventory,
  availableInventorySizes,
  inventoryBySizeTotal,
  normalizeInventoryBySize,
  productInventoryTotal,
  defaultProductSizes,
  resolveProductSizeType,
} from "./product-inventory.mjs";

sharp.cache(false);
sharp.concurrency(1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = __dirname;
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const usersFile = path.join(dataDir, "users.json");
const analyticsFile = path.join(dataDir, "analytics.json");
const ordersFile = path.join(dataDir, "orders.json");
const pushSubscriptionsFile = path.join(dataDir, "push-subscriptions.json");
const productsFile = path.join(dataDir, "products.json");
const uploadsDir = path.join(dataDir, "uploads");
const tryOnDir = path.join(dataDir, "try-on");
const tryOnArchiveFile = path.join(dataDir, "try-on.json");
const port = Number(process.env.PORT || 8080);
const apexHostname = "hallerboutiique.com";
const canonicalHostname = "www.hallerboutiique.com";
const sessionSecret = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const adminPassword = process.env.ADMIN_PASSWORD || "";
const openaiApiKey = process.env.OPENAI_API_KEY || "";
const openaiProductModel = process.env.OPENAI_PRODUCT_MODEL || "gpt-4.1-mini";
const openaiTryOnModel = process.env.OPENAI_TRYON_MODEL || "gpt-image-2";
const openaiTimeoutMs = 45000;
const openaiTryOnTimeoutMs = 180000;
const tryOnRetentionMs = 30 * 24 * 60 * 60 * 1000;
const tryOnJobRetentionMs = 15 * 60 * 1000;
const tryOnMaxActiveJobs = 4;
const tryOnProductCacheMaxBytes = 96 * 1024 * 1024;
const analyticsRetentionMs = 365 * 24 * 60 * 60 * 1000;
const liveWindowMs = 2 * 60 * 1000;
const replayMaxEvents = 500;
const geoLookupTimeoutMs = 1800;
const addressSuggestionTimeoutMs = 4500;
const minimumStorageReserveBytes = 64 * 1024 * 1024;
const orphanUploadGraceMs = 10 * 60 * 1000;
const productImageRenditionWidths = [480, 720, 1080, 1440];
const productImageSourceLimitBytes = 40 * 1024 * 1024;
const maximumStoredProductImages = 15;
const productImageBucketName = String(process.env.BUCKET_NAME || "").trim();
const productImageStorageEndpoint = String(process.env.AWS_ENDPOINT_URL_S3 || "https://t3.storage.dev").trim();
const productImageStorageRegion = String(process.env.AWS_REGION || "auto").trim();
const productImagePublicBaseUrl = productImageBucketName
  ? String(process.env.TIGRIS_PUBLIC_URL || `https://${productImageBucketName}.t3.tigrisfiles.io`).replace(/\/+$/, "")
  : "";
const productImageStorage = productImageBucketName
  ? new S3Client({ endpoint: productImageStorageEndpoint, region: productImageStorageRegion })
  : null;
let productImageStorageReadyPromise = null;
let productImageOptimizationJob = null;
let productZoomImageOptimizationJob = null;
const productImageOptimizationTimers = new Map();
const tryOnProductImageCache = new Map();
const tryOnProductImageInflight = new Map();
let tryOnProductImageCacheBytes = 0;
let productMutationQueue = Promise.resolve();
let orderMutationQueue = Promise.resolve();
let pushSubscriptionMutationQueue = Promise.resolve();
let mobilePushQueueRunning = false;
let productImageOptimizationStatus = {
  state: "idle",
  total: 0,
  processed: 0,
  optimized: 0,
  skipped: 0,
  failed: 0,
  current: "",
};
let productZoomImageOptimizationStatus = {
  state: "idle",
  total: 0,
  processed: 0,
  optimized: 0,
  skipped: 0,
  failed: 0,
  current: "",
};
const geoCache = new Map();
const addressSuggestionCache = new Map();
const addressSuggestionRateLimits = new Map();
const tryOnJobs = new Map();
const tryOnRequestJobs = new Map();

function enqueueProductMutation(mutation) {
  const result = productMutationQueue.then(mutation, mutation);
  productMutationQueue = result.catch(() => {});
  return result;
}

function enqueueOrderMutation(mutation) {
  const result = orderMutationQueue.then(mutation, mutation);
  orderMutationQueue = result.catch(() => undefined);
  return result;
}

function enqueuePushSubscriptionMutation(mutation) {
  const result = pushSubscriptionMutationQueue.then(mutation, mutation);
  pushSubscriptionMutationQueue = result.catch(() => undefined);
  return result;
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};
const publicFiles = new Set([
  "/index.html",
  "/checkout.html",
  "/account.html",
  "/ultimi-disponibili.html",
  "/product.html",
  "/admin.html",
  "/spedizioni.html",
  "/termini.html",
  "/privacy.html",
  "/styles.css",
  "/script.js",
  "/i18n.js",
  "/account.js",
  "/admin.js",
]);
const versionedPublicFiles = new Map([
  ["/assets-v/tryon-no-shoes-1/script.js", "/script.js"],
  ["/assets-v/tryon-polling-2/script.js", "/script.js"],
  ["/assets-v/checkout-mobile-logo-2/styles.css", "/styles.css"],
  ["/assets-v/checkout-mobile-logo-3/styles.css", "/styles.css"],
  ["/assets-v/checkout-address-1/script.js", "/script.js"],
  ["/assets-v/checkout-address-1/styles.css", "/styles.css"],
  ["/assets-v/checkout-logo-large-1/styles.css", "/styles.css"],
  ["/assets-v/checkout-logo-original-1/styles.css", "/styles.css"],
  ["/assets-v/checkout-logo-inline-original-1/styles.css", "/styles.css"],
  ["/assets-v/checkout-clothing-tryon-1/script.js", "/script.js"],
  ["/assets-v/checkout-clothing-tryon-1/styles.css", "/styles.css"],
  ["/assets-v/home-hide-last-stock-1/script.js", "/script.js"],
  ["/assets-v/mobile-logo-all-pages-1/styles.css", "/styles.css"],
  ["/assets-v/mobile-logo-all-pages-2/styles.css", "/styles.css"],
  ["/assets-v/mobile-logo-all-pages-3/styles.css", "/styles.css"],
  ["/assets-v/header-logo-stable-1/styles.css", "/styles.css"],
  ["/assets-v/hero-tryon-copy-1/styles.css", "/styles.css"],
  ["/assets-v/checkout-open-images-1/script.js", "/script.js"],
  ["/assets-v/checkout-images-full-1/script.js", "/script.js"],
  ["/assets-v/checkout-images-gallery-1/script.js", "/script.js"],
  ["/assets-v/tryon-all-non-shoes-2/script.js", "/script.js"],
  ["/assets-v/tryon-all-products-1/script.js", "/script.js"],
  ["/assets-v/tryon-all-photos-1/script.js", "/script.js"],
  ["/assets-v/tryon-primary-photo-1/script.js", "/script.js"],
  ["/assets-v/home-hide-last-stock-mobile-1/script.js", "/script.js"],
  ["/assets-v/inventory-last-stock-1/script.js", "/script.js"],
  ["/assets-v/home-tryon-callout-1/styles.css", "/styles.css"],
  ["/assets-v/legal-logo-standard-1/styles.css", "/styles.css"],
  ["/assets-v/size-inventory-1/styles.css", "/styles.css"],
  ["/assets-v/size-inventory-1/script.js", "/script.js"],
  ["/assets-v/size-inventory-1/admin.js", "/admin.js"],
  ["/assets-v/admin-original-price-5/styles.css", "/styles.css"],
  ["/assets-v/admin-original-price-5/script.js", "/script.js"],
  ["/assets-v/admin-original-price-5/admin.js", "/admin.js"],
  ["/assets-v/admin-upload-speed-1/admin.js", "/admin.js"],
  ["/assets-v/admin-search-all-1/admin.js", "/admin.js"],
  ["/assets-v/admin-shoe-ranges-1/admin.js", "/admin.js"],
  ["/assets-v/tryon-speed-1/script.js", "/script.js"],
  ["/assets-v/delivery-minutes-1/script.js", "/script.js"],
]);
const publicAssetExtensions = new Set([".png", ".jpg", ".jpeg", ".svg", ".ico", ".webp"]);

const oauthProviders = {
  google: {
    label: "Google",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
  },
  microsoft: {
    label: "Microsoft",
    env: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "openid email profile",
    useIdToken: true,
  },
};

async function ensureStorage() {
  await fs.mkdir(dataDir, { recursive: true });
  await ensureJsonFile(usersFile, []);
  await ensureJsonFile(analyticsFile, { sessions: {}, events: [] });
  await ensureJsonFile(ordersFile, []);
  await ensureJsonFile(pushSubscriptionsFile, []);
  await ensureJsonFile(productsFile, { items: {}, custom: [] });
  await ensureJsonFile(tryOnArchiveFile, []);
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(tryOnDir, { recursive: true });
}

async function ensureJsonFile(filePath, fallback) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  }
}

async function readJson(filePath, fallback) {
  await ensureStorage();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await ensureStorage();
  const tmp = `${filePath}.${Date.now()}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await fs.rename(tmp, filePath);
  } catch (error) {
    await fs.unlink(tmp).catch(() => undefined);
    throw error;
  }
}

async function readUsers() {
  return readJson(usersFile, []);
}

async function writeUsers(users) {
  return writeJson(usersFile, users);
}

async function readOrders() {
  return readJson(ordersFile, []);
}

async function writeOrders(orders) {
  return writeJson(ordersFile, orders);
}

async function readPushSubscriptions() {
  const subscriptions = await readJson(pushSubscriptionsFile, []);
  return Array.isArray(subscriptions) ? subscriptions : [];
}

async function writePushSubscriptions(subscriptions) {
  return writeJson(pushSubscriptionsFile, Array.isArray(subscriptions) ? subscriptions.slice(-50) : []);
}

async function readProductOverrides() {
  const data = await readJson(productsFile, { items: {}, custom: [] });
  data.items = data.items && typeof data.items === "object" ? data.items : {};
  data.custom = Array.isArray(data.custom) ? data.custom : [];
  return data;
}

async function writeProductOverrides(data) {
  await writeJson(productsFile, {
    updatedAt: new Date().toISOString(),
    items: data.items && typeof data.items === "object" ? data.items : {},
    custom: Array.isArray(data.custom) ? data.custom : [],
  });
}

function uploadFileName(value) {
  let cleanValue = String(value || "").trim();
  if (/^https?:\/\//i.test(cleanValue)) {
    try {
      cleanValue = new URL(cleanValue).pathname;
    } catch {
      return "";
    }
  }
  cleanValue = cleanValue.split(/[?#]/)[0];
  const match = cleanValue.match(/^\/?uploads\/([^/]+)$/i);
  return match ? path.basename(match[1]) : "";
}

function referencedProductUploadNames(data) {
  const items = data?.items && typeof data.items === "object" ? Object.values(data.items) : [];
  const custom = Array.isArray(data?.custom) ? data.custom : [];
  const referenced = new Set();
  [...items, ...custom].forEach((product) => {
    const renditionImages = Object.values(cleanProductImageRenditions(product?.imageRenditions, product?.images))
      .flatMap((entries) => entries.map((entry) => entry.url));
    [
      ...cleanProductImages(product?.images),
      ...cleanProductImages(product?.originalImages),
      ...cleanProductImages(product?.zoomImages),
      ...renditionImages,
    ].forEach((image) => {
      const name = uploadFileName(image);
      if (name) referenced.add(name);
    });
  });
  return referenced;
}

function productObjectKey(value) {
  if (!productImagePublicBaseUrl || !/^https?:\/\//i.test(String(value || ""))) return "";
  try {
    const imageUrl = new URL(value);
    const publicUrl = new URL(productImagePublicBaseUrl);
    if (imageUrl.origin !== publicUrl.origin) return "";
    return decodeURIComponent(imageUrl.pathname.replace(/^\/+/, ""));
  } catch {
    return "";
  }
}

function productZoomDeliveryPath(value) {
  const key = productObjectKey(value);
  if (!key.startsWith("products/")) return value;
  const name = key.slice("products/".length);
  if (!name || name !== path.basename(name)) return value;
  return `/product-images/${encodeURIComponent(name)}`;
}

function referencedProductObjectKeys(data) {
  const items = data?.items && typeof data.items === "object" ? Object.values(data.items) : [];
  const custom = Array.isArray(data?.custom) ? data.custom : [];
  const referenced = new Set();
  [...items, ...custom].forEach((product) => {
    const renditionImages = Object.values(cleanProductImageRenditions(product?.imageRenditions, product?.images))
      .flatMap((entries) => entries.map((entry) => entry.url));
    [
      ...cleanProductImages(product?.images),
      ...cleanProductImages(product?.originalImages),
      ...cleanProductImages(product?.zoomImages),
      ...renditionImages,
    ].forEach((image) => {
      const key = productObjectKey(image);
      if (key) referenced.add(key);
    });
  });
  return referenced;
}

async function ensureProductImageStorage() {
  if (!productImageStorage) return false;
  if (!productImageStorageReadyPromise) {
    productImageStorageReadyPromise = productImageStorage.send(new PutBucketCorsCommand({
      Bucket: productImageBucketName,
      CORSConfiguration: {
        CORSRules: [{
          AllowedHeaders: ["*"],
          AllowedMethods: ["GET", "HEAD"],
          AllowedOrigins: ["*"],
          ExposeHeaders: ["Content-Length", "Content-Type", "ETag"],
          MaxAgeSeconds: 86400,
        }],
      },
    })).then(() => true).catch((error) => {
      productImageStorageReadyPromise = null;
      throw error;
    });
  }
  return productImageStorageReadyPromise;
}

async function verifyProductImageStorage() {
  if (!productImageStorage) return false;
  const body = Buffer.from("ready\n", "utf8");
  await productImageStorage.send(new PutObjectCommand({
    Bucket: productImageBucketName,
    Key: "checks/storage-ready.txt",
    Body: body,
    ContentLength: body.length,
    ContentType: "text/plain; charset=utf-8",
    CacheControl: "no-store",
    ContentDisposition: "inline",
  }));
  return true;
}

function storedImageContentType(extension, suppliedType) {
  const cleanType = String(suppliedType || "").split(";")[0].trim().toLowerCase();
  if (["image/jpeg", "image/png", "image/webp"].includes(cleanType)) return cleanType;
  return contentTypes[extension] || "application/octet-stream";
}

async function storeProductImage(name, data, contentType) {
  if (!productImageStorage) {
    await ensureProductUploadCapacity(data.length);
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, name), data);
    return `/uploads/${name}`;
  }

  const key = `products/${name}`;
  const extension = path.extname(name).toLowerCase();
  await productImageStorage.send(new PutObjectCommand({
    Bucket: productImageBucketName,
    Key: key,
    Body: data,
    ContentLength: data.length,
    ContentType: storedImageContentType(extension, contentType),
    CacheControl: "public, max-age=31536000, immutable",
    ContentDisposition: "inline",
  }));
  return `${productImagePublicBaseUrl}/${key}`;
}

async function storeProductImageRendition(name, data) {
  if (productImageStorage) {
    return storeProductImage(name, data, "image/webp");
  }

  await fs.mkdir(uploadsDir, { recursive: true });
  const target = path.join(uploadsDir, name);
  const existingSize = await fs.stat(target).then((stat) => stat.size, () => 0);
  await ensureProductUploadCapacity(Math.max(0, data.length - existingSize));
  const temporary = `${target}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(temporary, data);
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.unlink(temporary).catch(() => undefined);
    throw error;
  }
  return `/uploads/${name}`;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function createProductImageRenditions(name, data, existingEntries = [], { refreshHighQuality = false } = {}) {
  try {
    const metadata = await sharp(data, { failOn: "none" }).metadata();
    const orientation = Number(metadata.orientation || 1);
    const sourceWidth = orientation >= 5 && orientation <= 8 ? metadata.height : metadata.width;
    if (!Number.isFinite(sourceWidth) || sourceWidth < 1) return [];

    const widths = [...new Set(productImageRenditionWidths.map((width) => Math.min(width, sourceWidth)))];
    const baseName = path.basename(name, path.extname(name));
    const existingByWidth = new Map(
      (Array.isArray(existingEntries) ? existingEntries : [])
        .filter((entry) => entry?.url && Number.isInteger(Number(entry.width)) && Number(entry.width) > 0)
        .filter((entry) => !refreshHighQuality || Number(entry.width) < 1080)
        .map((entry) => [Number(entry.width), entry])
    );
    const renditions = [];
    for (const width of widths) {
      const existing = existingByWidth.get(width);
      if (existing) {
        renditions.push(existing);
        continue;
      }
      let pipeline = sharp(data, { failOn: "none" })
        .rotate()
        .resize({ width, withoutEnlargement: true, fit: "inside" });
      if (width >= 1080) pipeline = pipeline.sharpen(0.55);
      const output = await pipeline
        .webp({ quality: width >= 1080 ? 98 : 95, alphaQuality: 100, smartSubsample: true, effort: 3 })
        .toBuffer({ resolveWithObject: true });
      const renditionName = `${baseName}-${output.info.width}w.webp`;
      const url = await storeProductImageRendition(renditionName, output.data);
      renditions.push({
        url,
        width: output.info.width,
        height: output.info.height,
        type: "image/webp",
      });
    }
    return renditions;
  } catch (error) {
    console.error(`Responsive product image skipped for ${name}: ${error.message}`);
    return [];
  }
}

function isLocalRequest(req) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(String(req.socket.remoteAddress || ""));
}

async function readProductImageSource(image) {
  const value = String(image || "").split("?")[0];
  let filePath = "";
  if (value.startsWith("/uploads/")) {
    filePath = path.normalize(path.join(uploadsDir, value.slice("/uploads/".length)));
    if (!filePath.startsWith(`${uploadsDir}${path.sep}`)) throw new Error("Percorso upload non valido.");
  } else if (value.startsWith("assets/")) {
    filePath = path.normalize(path.join(publicDir, value));
    if (!filePath.startsWith(`${publicDir}${path.sep}`)) throw new Error("Percorso asset non valido.");
  }

  if (filePath) {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > productImageSourceLimitBytes) throw new Error("Immagine sorgente troppo grande.");
    return fs.readFile(filePath);
  }

  if (!/^https:\/\//i.test(value)) throw new Error("Sorgente immagine non supportata.");
  const sourceUrl = new URL(value);
  if (!productImagePublicBaseUrl || sourceUrl.origin !== new URL(productImagePublicBaseUrl).origin) {
    throw new Error("Origine immagine esterna non consentita.");
  }
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Download immagine non riuscito (${response.status}).`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > productImageSourceLimitBytes) throw new Error("Immagine sorgente troppo grande.");
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > productImageSourceLimitBytes) throw new Error("Immagine sorgente non valida.");
  return data;
}

function cacheTryOnProductImage(source, image) {
  const previous = tryOnProductImageCache.get(source);
  if (previous) tryOnProductImageCacheBytes -= previous.data.length;
  tryOnProductImageCache.delete(source);
  tryOnProductImageCache.set(source, image);
  tryOnProductImageCacheBytes += image.data.length;

  while (tryOnProductImageCacheBytes > tryOnProductCacheMaxBytes && tryOnProductImageCache.size > 1) {
    const oldestKey = tryOnProductImageCache.keys().next().value;
    const oldest = tryOnProductImageCache.get(oldestKey);
    tryOnProductImageCache.delete(oldestKey);
    tryOnProductImageCacheBytes -= oldest?.data?.length || 0;
  }
}

async function loadTryOnProductReference(source, index) {
  const cached = tryOnProductImageCache.get(source);
  if (cached) {
    tryOnProductImageCache.delete(source);
    tryOnProductImageCache.set(source, cached);
    return { ...cached, filename: `product-${index + 1}.jpg` };
  }

  let pending = tryOnProductImageInflight.get(source);
  if (!pending) {
    pending = (async () => {
      const data = await readProductImageSource(source);
      const normalized = await normalizeTryOnProductImage({
        data,
        mime: imageMimeFromExtension(path.extname(String(source).split(/[?#]/)[0]).toLowerCase()),
        filename: path.basename(String(source).split(/[?#]/)[0]),
      });
      const image = { data: normalized.data, mime: normalized.mime };
      cacheTryOnProductImage(source, image);
      return image;
    })().finally(() => tryOnProductImageInflight.delete(source));
    tryOnProductImageInflight.set(source, pending);
  }

  const image = await pending;
  return { ...image, filename: `product-${index + 1}.jpg` };
}

async function loadCatalogTryOnProductImages(productIds) {
  const ids = productIds.map((id) => cleanTrackingString(id, 120)).filter(Boolean);
  if (!ids.length) return [];
  const [defaults, overrides] = await Promise.all([readDefaultProducts(), readProductOverrides()]);
  const catalog = [
    ...defaults.map((product) => mergeProduct(product, overrides.items)),
    ...overrides.custom.map(mergeCustomProduct),
  ];
  const byId = new Map(catalog.map((product) => [product.id, product]));

  return Promise.all(ids.map(async (id, index) => {
    const product = byId.get(id);
    const source = cleanProductImages(product?.originalImages)[0]
      || cleanProductImages(product?.images)[0];
    if (!source) throw new Error(`Foto prodotto try-on non disponibile: ${id}`);
    return loadTryOnProductReference(source, index);
  }));
}

async function createAndStoreProductZoomImage(productId, originalImage, publishedImage) {
  const output = await createMatchingProductZoomImage(originalImage, publishedImage);
  const fingerprint = createHash("sha256")
    .update(originalImage)
    .update(publishedImage)
    .update("original-pixels-matching-crop-v2")
    .digest("hex")
    .slice(0, 16);
  const extension = output.type === "image/jpeg" ? "jpg" : "webp";
  const name = `${slugifyProduct(productId)}-zoom-${fingerprint}-${output.width}x${output.height}.${extension}`;
  const url = await storeProductImage(name, output.data, output.type);
  return { url, width: output.width, height: output.height };
}

async function persistProductImageOptimization(data) {
  await writeJson(productsFile, {
    updatedAt: new Date().toISOString(),
    items: data.items,
    custom: data.custom,
  });
}

async function productImageRenditionsExist(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  const checks = await mapWithConcurrency(entries, 5, async (entry) => {
    const key = productObjectKey(entry?.url);
    if (key && productImageStorage) {
      try {
        await productImageStorage.send(new HeadObjectCommand({ Bucket: productImageBucketName, Key: key }));
        return true;
      } catch (error) {
        if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) return false;
        throw error;
      }
    }
    const uploadName = uploadFileName(entry?.url);
    if (uploadName) return fs.access(path.join(uploadsDir, uploadName)).then(() => true, () => false);
    return false;
  });
  return checks.every(Boolean);
}

async function productImageExists(image) {
  const key = productObjectKey(image);
  if (key && productImageStorage) {
    try {
      await productImageStorage.send(new HeadObjectCommand({ Bucket: productImageBucketName, Key: key }));
      return true;
    } catch (error) {
      if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }
  const uploadName = uploadFileName(image);
  return uploadName
    ? fs.access(path.join(uploadsDir, uploadName)).then(() => true, () => false)
    : false;
}

async function optimizeExistingProductImages({ primaryOnly = false, force = false, productId = "", refreshHighQuality = false } = {}) {
  const data = await readProductOverrides();
  const products = [
    ...Object.entries(data.items).map(([id, product]) => ({ id, product })),
    ...data.custom.map((product, index) => ({ id: product.id || `custom-${index}`, product })),
  ].filter((entry) => !productId || entry.id === productId);
  const tasks = products
    .flatMap(({ id, product }) => {
      const originals = cleanProductImages(product.originalImages);
      return cleanProductImages(product.images).map((image, index) => ({
        id,
        product,
        image,
        sourceImage: product.imageVariant === "cropped" ? image : originals[index] || image,
        index,
      }));
    })
    .filter((task) => !primaryOnly || task.index === 0)
    .sort((left, right) => {
      const priority = (index) => index === 1 ? -1 : index;
      return priority(left.index) - priority(right.index);
    });

  productImageOptimizationStatus = {
    state: "running",
    total: tasks.length,
    processed: 0,
    optimized: 0,
    skipped: 0,
    failed: 0,
    current: "",
  };

  await mapWithConcurrency(tasks, productId ? 1 : primaryOnly ? 2 : 4, async (task) => {
    productImageOptimizationStatus.current = `${task.id}: ${task.image}`;
    let previous = {};
    try {
      const existing = cleanProductImageRenditions(task.product.imageRenditions, task.product.images);
      previous = existing;
      const existingRenditionsAvailable = await productImageRenditionsExist(existing[task.image]);
      if (!force && !refreshHighQuality && existingRenditionsAvailable) {
        productImageOptimizationStatus.skipped += 1;
      } else {
        const source = await readProductImageSource(task.sourceImage);
        const fingerprint = createHash("sha256").update(source).digest("hex").slice(0, 16);
        const name = `${slugifyProduct(task.id)}-responsive-${fingerprint}.webp`;
        const reusableRenditions = force || !existingRenditionsAvailable ? [] : existing[task.image];
        const renditions = await createProductImageRenditions(name, source, reusableRenditions, { refreshHighQuality });
        if (!renditions.length) throw new Error("Nessuna variante generata.");
        task.product.imageRenditions = {
          ...cleanProductImageRenditions(task.product.imageRenditions, task.product.images),
          [task.image]: renditions,
        };
        await persistProductImageOptimization(data);
        productImageOptimizationStatus.optimized += 1;
      }
    } catch (error) {
      const remaining = cleanProductImageRenditions(task.product.imageRenditions, task.product.images);
      if (Array.isArray(previous[task.image]) && previous[task.image].length) {
        remaining[task.image] = previous[task.image];
      } else {
        delete remaining[task.image];
      }
      task.product.imageRenditions = remaining;
      await persistProductImageOptimization(data).catch(() => undefined);
      productImageOptimizationStatus.failed += 1;
      console.error(`Product image optimization failed for ${task.image}: ${error.message}`);
    } finally {
      productImageOptimizationStatus.processed += 1;
    }
  });

  await persistProductImageOptimization(data);
  productImageOptimizationStatus = {
    ...productImageOptimizationStatus,
    state: productImageOptimizationStatus.failed ? "completed_with_errors" : "completed",
    current: "",
  };
}

async function optimizeExistingProductZoomImages({ force = false, productId = "" } = {}) {
  const data = await readProductOverrides();
  const products = [
    ...Object.entries(data.items).map(([id, product]) => ({ id, product })),
    ...data.custom.map((product, index) => ({ id: product.id || `custom-${index}`, product })),
  ].filter((entry) => !productId || entry.id === productId);
  const tasks = products.flatMap(({ id, product }) => {
    const images = cleanProductImages(product.images);
    const originals = cleanProductImages(product.originalImages);
    const currentZoomImages = cleanProductImages(product.zoomImages);
    product.zoomImages = images.map((image, index) => currentZoomImages[index] || image);
    return images
      .map((image, index) => ({ id, product, image, original: originals[index], index }))
      .filter((task) => task.original && task.original !== task.image);
  });

  productZoomImageOptimizationStatus = {
    state: "running",
    total: tasks.length,
    processed: 0,
    optimized: 0,
    skipped: 0,
    failed: 0,
    current: "",
  };

  await mapWithConcurrency(tasks, 1, async (task) => {
    productZoomImageOptimizationStatus.current = `${task.id}: ${task.image}`;
    const previous = task.product.zoomImages[task.index] || task.image;
    try {
      if (!force && previous !== task.image && await productImageExists(previous)) {
        productZoomImageOptimizationStatus.skipped += 1;
      } else {
        const [originalImage, publishedImage] = await Promise.all([
          readProductImageSource(task.original),
          readProductImageSource(task.image),
        ]);
        const generated = await createAndStoreProductZoomImage(task.id, originalImage, publishedImage);
        task.product.zoomImages[task.index] = generated.url;
        await persistProductImageOptimization(data);
        productZoomImageOptimizationStatus.optimized += 1;
      }
    } catch (error) {
      task.product.zoomImages[task.index] = previous;
      productZoomImageOptimizationStatus.failed += 1;
      console.error(`Product zoom image optimization failed for ${task.image}: ${error.message}`);
    } finally {
      productZoomImageOptimizationStatus.processed += 1;
    }
  });

  await persistProductImageOptimization(data);
  productZoomImageOptimizationStatus = {
    ...productZoomImageOptimizationStatus,
    state: productZoomImageOptimizationStatus.failed ? "completed_with_errors" : "completed",
    current: "",
  };
}

function scheduleProductImageOptimization(productId) {
  const id = cleanTrackingString(productId, 120);
  if (!id) return;
  const existingTimer = productImageOptimizationTimers.get(id);
  if (existingTimer) clearTimeout(existingTimer);
  const timer = setTimeout(() => {
    productImageOptimizationTimers.delete(id);
    void enqueueProductMutation(async () => {
      await optimizeExistingProductImages({ productId: id });
      await optimizeExistingProductZoomImages({ productId: id });
    }).catch((error) => {
      console.error(`Background product image optimization failed for ${id}: ${error.message}`);
    });
  }, 5000);
  timer.unref?.();
  productImageOptimizationTimers.set(id, timer);
}

function handleProductImageOptimization(req, res, url) {
  if (!isLocalRequest(req)) return notFound(res);
  if (req.method === "GET") return json(res, 200, { ok: true, ...productImageOptimizationStatus });
  if (req.method !== "POST") return notFound(res);
  if (!productImageOptimizationJob) {
    productImageOptimizationJob = optimizeExistingProductImages({
      primaryOnly: url.searchParams.get("scope") === "previews",
      force: url.searchParams.get("force") === "1",
      productId: cleanTrackingString(url.searchParams.get("product"), 120),
      refreshHighQuality: url.searchParams.get("high") === "1",
    })
      .catch((error) => {
        productImageOptimizationStatus = { ...productImageOptimizationStatus, state: "failed", current: "", message: error.message };
        console.error(`Product image optimization stopped: ${error.message}`);
      })
      .finally(() => {
        productImageOptimizationJob = null;
      });
  }
  return json(res, 202, { ok: true, ...productImageOptimizationStatus });
}

function handleProductZoomImageOptimization(req, res, url) {
  if (!isLocalRequest(req)) return notFound(res);
  if (req.method === "GET") return json(res, 200, { ok: true, ...productZoomImageOptimizationStatus });
  if (req.method !== "POST") return notFound(res);
  if (!productZoomImageOptimizationJob) {
    productZoomImageOptimizationJob = enqueueProductMutation(() => optimizeExistingProductZoomImages({
      force: url.searchParams.get("force") === "1",
      productId: cleanTrackingString(url.searchParams.get("product"), 120),
    }))
      .catch((error) => {
        productZoomImageOptimizationStatus = {
          ...productZoomImageOptimizationStatus,
          state: "failed",
          current: "",
          message: error.message,
        };
        console.error(`Product zoom image optimization stopped: ${error.message}`);
      })
      .finally(() => {
        productZoomImageOptimizationJob = null;
      });
  }
  return json(res, 202, { ok: true, ...productZoomImageOptimizationStatus });
}

async function deleteProductObjects(keys) {
  if (!productImageStorage || !keys.length) return;
  for (let index = 0; index < keys.length; index += 1000) {
    await productImageStorage.send(new DeleteObjectsCommand({
      Bucket: productImageBucketName,
      Delete: { Objects: keys.slice(index, index + 1000).map((Key) => ({ Key })), Quiet: true },
    }));
  }
}

async function pruneOrphanProductObjects({ minAgeMs = orphanUploadGraceMs } = {}) {
  if (!productImageStorage) return { removedFiles: 0 };
  let data;
  try {
    data = JSON.parse(await fs.readFile(productsFile, "utf8"));
  } catch {
    return { removedFiles: 0 };
  }

  const referenced = referencedProductObjectKeys(data);
  const stale = [];
  const now = Date.now();
  let continuationToken;
  do {
    const page = await productImageStorage.send(new ListObjectsV2Command({
      Bucket: productImageBucketName,
      Prefix: "products/",
      ContinuationToken: continuationToken,
    }));
    (page.Contents || []).forEach((object) => {
      const key = String(object.Key || "");
      const modifiedAt = object.LastModified instanceof Date ? object.LastModified.getTime() : 0;
      if (key && !referenced.has(key) && now - modifiedAt >= minAgeMs) stale.push(key);
    });
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  await deleteProductObjects(stale);
  if (stale.length > 0) console.log(`Tigris cleanup removed ${stale.length} orphan product images.`);
  return { removedFiles: stale.length };
}

async function pruneStaleStorageTemps({ minAgeMs = 60 * 1000 } = {}) {
  const now = Date.now();
  const entries = await fs.readdir(dataDir, { withFileTypes: true }).catch(() => []);
  let removedBytes = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".tmp")) continue;
    const filePath = path.join(dataDir, entry.name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || now - stat.mtimeMs < minAgeMs) continue;
    await fs.unlink(filePath).catch(() => undefined);
    removedBytes += stat.size;
  }
  if (removedBytes > 0) console.log(`Storage cleanup removed ${Math.round(removedBytes / 1024 / 1024)} MB of temporary files.`);
  return removedBytes;
}

async function pruneOrphanProductUploads({ minAgeMs = orphanUploadGraceMs } = {}) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(productsFile, "utf8"));
  } catch {
    return { removedFiles: 0, removedBytes: 0 };
  }
  const referenced = referencedProductUploadNames(data);
  const entries = await fs.readdir(uploadsDir, { withFileTypes: true }).catch(() => []);
  const now = Date.now();
  let removedFiles = 0;
  let removedBytes = 0;
  for (const entry of entries) {
    if (!entry.isFile() || referenced.has(entry.name)) continue;
    const filePath = path.join(uploadsDir, entry.name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || now - stat.mtimeMs < minAgeMs) continue;
    try {
      await fs.unlink(filePath);
      removedFiles += 1;
      removedBytes += stat.size;
    } catch {}
  }
  if (removedFiles > 0) {
    console.log(`Storage cleanup removed ${removedFiles} orphan product images (${Math.round(removedBytes / 1024 / 1024)} MB).`);
  }
  return { removedFiles, removedBytes };
}

function storageCapacityError() {
  const error = new Error("Spazio immagini esaurito. Rimuovi alcune foto non necessarie o aumenta lo spazio Fly, poi riprova.");
  error.code = "STORAGE_FULL";
  return error;
}

function isStorageCapacityError(error) {
  return error?.code === "ENOSPC" || error?.code === "STORAGE_FULL";
}

async function ensureProductUploadCapacity(requiredBytes) {
  const stat = await fs.statfs(dataDir);
  const availableBytes = Number(stat.bavail) * Number(stat.bsize);
  if (availableBytes < Number(requiredBytes || 0) + minimumStorageReserveBytes) throw storageCapacityError();
}

async function readTryOnArchive() {
  const data = await readJson(tryOnArchiveFile, []);
  return Array.isArray(data) ? data : [];
}

async function pruneTryOnArchive() {
  const records = await readTryOnArchive();
  const now = Date.now();
  const active = [];
  const expired = [];

  records.forEach((record) => {
    if (new Date(record.expiresAt || 0).getTime() > now) active.push(record);
    else expired.push(record);
  });

  await Promise.all(
    expired.flatMap((record) => [record.sourceFile, record.previewFile].filter(Boolean)).map((name) =>
      fs.unlink(path.join(tryOnDir, path.basename(name))).catch(() => undefined)
    )
  );
  if (expired.length > 0) await writeJson(tryOnArchiveFile, active);
  return active;
}

async function readAnalytics() {
  const data = await readJson(analyticsFile, { sessions: {}, events: [] });
  data.sessions = data.sessions && typeof data.sessions === "object" ? data.sessions : {};
  data.events = Array.isArray(data.events) ? data.events : [];
  return data;
}

async function writeAnalytics(data) {
  const cutoff = Date.now() - analyticsRetentionMs;
  data.events = data.events
    .filter((event) => new Date(event.at).getTime() >= cutoff)
    .slice(-8000);

  Object.entries(data.sessions).forEach(([id, session]) => {
    if (new Date(session.lastSeenAt || session.startedAt).getTime() < cutoff) {
      delete data.sessions[id];
      return;
    }
    if (Array.isArray(session.replay)) {
      session.replay = session.replay.slice(-replayMaxEvents);
    }
  });

  return writeJson(analyticsFile, data);
}

let analyticsMutationQueue = Promise.resolve();

function mutateAnalytics(mutator) {
  const operation = analyticsMutationQueue.then(async () => {
    const analytics = await readAnalytics();
    const result = await mutator(analytics);
    await writeAnalytics(analytics);
    return result;
  });
  analyticsMutationQueue = operation.catch(() => undefined);
  return operation;
}

function json(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(payload);
}

function createProgressStream(res) {
  let ended = false;
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();

  const send = (body) => {
    if (!ended) res.write(`${JSON.stringify(body)}\n`);
  };

  return {
    update(progress, message) {
      send({ type: "progress", progress: Math.max(0, Math.min(100, Math.round(progress))), message });
    },
    done(data) {
      send({ type: "result", data });
      ended = true;
      res.end();
    },
    fail(message) {
      send({ type: "error", message });
      ended = true;
      res.end();
    },
  };
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

function badRequest(res, message) {
  json(res, 400, { ok: false, message });
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function normalizeIp(ip) {
  return String(ip || "")
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/^::ffff:/, "");
}

function cleanIp(ip) {
  const normalized = normalizeIp(ip);
  return isIP(normalized) ? normalized : "";
}

function clientIp(req) {
  const directHeaders = ["fly-client-ip", "cf-connecting-ip", "true-client-ip", "x-real-ip"];
  for (const header of directHeaders) {
    const candidate = cleanIp(req.headers[header]);
    if (candidate) return candidate;
  }

  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map(cleanIp)
    .find(Boolean);

  return forwarded || cleanIp(req.socket.remoteAddress);
}

function maskIp(ip) {
  if (!ip) return "";
  if (ip.includes(":")) {
    return `${ip.split(":").slice(0, 4).join(":")}::`;
  }
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return "";
}

function hashIp(ip) {
  return ip ? createHash("sha256").update(`${sessionSecret}:${ip}`).digest("hex").slice(0, 16) : "";
}

function isPrivateOrReservedIp(ip) {
  const normalized = normalizeIp(ip);
  const version = isIP(normalized);
  if (!version) return true;
  if (version === 4) {
    const parts = normalized.split(".").map((part) => Number.parseInt(part, 10));
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0)
    );
  }

  const lower = normalized.toLowerCase();
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower.startsWith("ff") ||
    lower.startsWith("2001:db8")
  );
}

function cleanLocationField(value, max = 80) {
  return String(value || "")
    .replace(/[^\p{L}\p{N}\s.'-]/gu, "")
    .trim()
    .slice(0, max);
}

function emptyIpLocation() {
  return { country: "", countryCode: "", region: "", city: "" };
}

function rememberIpLocation(ip, location) {
  if (geoCache.size > 1000) geoCache.delete(geoCache.keys().next().value);
  geoCache.set(ip, { location, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
}

async function lookupIpLocation(ip) {
  const normalized = normalizeIp(ip);
  if (isPrivateOrReservedIp(normalized)) return emptyIpLocation();

  const cached = geoCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.location;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), geoLookupTimeoutMs);
  try {
    const response = await fetch(
      `https://ipwho.is/${encodeURIComponent(normalized)}?fields=success,country,country_code,region,city`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "HallerBoutique/1.0" },
      }
    );
    if (!response.ok) throw new Error("IP location lookup failed");
    const data = await response.json();
    if (data.success === false) throw new Error("IP location unavailable");
    const location = {
      country: cleanLocationField(data.country),
      countryCode: cleanLocationField(data.country_code, 8),
      region: cleanLocationField(data.region),
      city: cleanLocationField(data.city),
    };
    rememberIpLocation(normalized, location);
    return location;
  } catch {
    const location = emptyIpLocation();
    rememberIpLocation(normalized, location);
    return location;
  } finally {
    clearTimeout(timeout);
  }
}

function rememberAddressSuggestions(key, suggestions) {
  if (addressSuggestionCache.size >= 500) {
    addressSuggestionCache.delete(addressSuggestionCache.keys().next().value);
  }
  addressSuggestionCache.set(key, {
    suggestions,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });
}

function canRequestAddressSuggestions(ip) {
  const key = cleanIp(ip) || "unknown";
  const now = Date.now();
  const current = addressSuggestionRateLimits.get(key);
  if (!current || current.expiresAt <= now) {
    addressSuggestionRateLimits.set(key, { count: 1, expiresAt: now + 60 * 1000 });
    if (addressSuggestionRateLimits.size > 2000) {
      addressSuggestionRateLimits.delete(addressSuggestionRateLimits.keys().next().value);
    }
    return true;
  }
  current.count += 1;
  return current.count <= 30;
}

async function handleAddressSuggestions(req, res, url) {
  const query = String(url.searchParams.get("q") || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  if (query.length < 3) return json(res, 200, { ok: true, suggestions: [] });

  const cacheKey = query.toLocaleLowerCase("it");
  const cached = addressSuggestionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return json(res, 200, { ok: true, suggestions: cached.suggestions });
  }
  if (!canRequestAddressSuggestions(clientIp(req))) {
    return json(res, 429, { ok: false, message: "Troppe ricerche. Attendi qualche secondo e riprova." });
  }

  const endpoint = new URL("https://photon.komoot.io/api/");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", "12");
  endpoint.searchParams.set("countrycode", "IT");
  endpoint.searchParams.append("layer", "house");
  endpoint.searchParams.append("layer", "street");

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(addressSuggestionTimeoutMs),
      headers: {
        Accept: "application/json",
        "User-Agent": "HallerBoutique/1.0 (https://www.hallerboutiique.com/)",
      },
    });
    if (!response.ok) throw new Error(`Address lookup failed: ${response.status}`);
    const suggestions = normalizePhotonSuggestions(await response.json());
    rememberAddressSuggestions(cacheKey, suggestions);
    return json(res, 200, { ok: true, suggestions });
  } catch (error) {
    console.error(`[address] Suggestions unavailable: ${error.message}`);
    return json(res, 503, {
      ok: false,
      message: "I suggerimenti dell'indirizzo non sono disponibili. Riprova tra poco.",
    });
  }
}

function cleanDeviceField(value, max = 120) {
  return cleanTrackingString(value, max).replace(/[^\w .:/()+-]/g, "").slice(0, max);
}

function cleanVersion(value) {
  return cleanDeviceField(String(value || "").replace(/_/g, "."), 50);
}

function compactScreen(width, height, ratio) {
  const w = Math.max(0, Math.min(10000, Number.parseInt(width || 0, 10) || 0));
  const h = Math.max(0, Math.min(10000, Number.parseInt(height || 0, 10) || 0));
  const dpr = Math.max(0, Math.min(10, Number.parseFloat(ratio || 0) || 0));
  if (!w || !h) return "";
  return `${w}x${h}${dpr ? ` @${dpr}x` : ""}`;
}

function cleanClientDeviceInfo(info) {
  const source = info && typeof info === "object" ? info : {};
  return {
    model: cleanDeviceField(source.model),
    platform: cleanDeviceField(source.platform, 80),
    platformVersion: cleanVersion(source.platformVersion),
    architecture: cleanDeviceField(source.architecture, 40),
    bitness: cleanDeviceField(source.bitness, 20),
    mobile: Boolean(source.mobile),
    language: cleanDeviceField(source.language, 40),
    timezone: cleanDeviceField(source.timezone, 80),
    screen: compactScreen(source.screenWidth, source.screenHeight, source.pixelRatio),
    viewport: compactScreen(source.viewportWidth, source.viewportHeight, source.pixelRatio),
    touchPoints: Math.max(0, Math.min(20, Number.parseInt(source.touchPoints || 0, 10) || 0)),
  };
}

function detectAndroidModel(ua) {
  const match = ua.match(/Android\s+[\d.]+;\s*([^;)]+?)(?:\s+Build|\)|;)/i);
  if (!match) return "";
  return cleanDeviceField(match[1].replace(/\bwv\b/gi, "").trim());
}

function detectOsVersion(ua, os, clientInfo) {
  if (clientInfo.platformVersion && !/^0(?:\.0)*$/.test(clientInfo.platformVersion)) return clientInfo.platformVersion;
  if (os === "Android") return cleanVersion(ua.match(/Android\s+([\d.]+)/i)?.[1]);
  if (os === "iOS") return cleanVersion(ua.match(/(?:CPU iPhone OS|CPU OS)\s+([\d_]+)/i)?.[1]);
  if (os === "iPadOS") {
    return cleanVersion(ua.match(/CPU OS\s+([\d_]+)/i)?.[1] || ua.match(/Version\/([\d.]+)/i)?.[1]);
  }
  if (os === "macOS") return cleanVersion(ua.match(/Mac OS X\s+([\d_]+)/i)?.[1]);
  if (os === "Windows") return cleanVersion(ua.match(/Windows NT\s+([\d.]+)/i)?.[1]);
  return "";
}

function detectDeviceModel(ua, os, device, clientInfo) {
  if (clientInfo.model && !/unknown/i.test(clientInfo.model)) return clientInfo.model;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua) || os === "iPadOS") return "iPad";
  if (/iPod/i.test(ua)) return "iPod";
  if (os === "Android") return detectAndroidModel(ua) || "Android";
  if (os === "macOS") return "Mac";
  if (os === "Windows") return "PC Windows";
  if (device === "Tablet") return "Tablet";
  if (device === "Mobile") return "Mobile";
  return "Desktop";
}

function parseUserAgent(userAgent = "", clientInfo = {}) {
  const ua = String(userAgent);
  const ipadDesktopMode = /Macintosh/i.test(ua) && /Mobile\/\w+ Safari/i.test(ua);
  const mobile = /Mobile|Android|iPhone|iPod/i.test(ua);
  const tablet = /iPad|Tablet/i.test(ua) || ipadDesktopMode;
  const device = tablet ? "Tablet" : mobile ? "Mobile" : "Desktop";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPod/i.test(ua)
        ? "iOS"
        : /iPad/i.test(ua) || ipadDesktopMode
          ? "iPadOS"
          : /Mac OS|Macintosh/i.test(ua)
            ? "macOS"
            : /Linux/i.test(ua)
              ? "Linux"
              : "Altro";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua) && !/Edg\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua) && !/Chrome\//i.test(ua)
          ? "Safari"
          : /Firefox\//i.test(ua)
            ? "Firefox"
            : "Altro";
  const osVersion = detectOsVersion(ua, os, clientInfo);
  const deviceModel = detectDeviceModel(ua, os, device, clientInfo);

  return { device, os, osVersion, browser, deviceModel };
}

function parseEuro(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(".", "")
    .replace(",", ".");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatEuroValue(value) {
  return Math.round(value * 100) / 100;
}

function countBy(items, getKey) {
  const counts = {};
  items.forEach((item) => {
    const key = getKey(item) || "Altro";
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function productRowsFromOrder(order) {
  return Array.isArray(order.products) && order.products.length > 0
    ? order.products
    : [{ name: order.product || "Da confermare", price: order.total || "0€", quantity: 1 }];
}

function slugifyProduct(value) {
  return String(value || "prodotto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "prodotto";
}

function productIdForName(name, counters) {
  const slug = slugifyProduct(name);
  counters[slug] = (counters[slug] || 0) + 1;
  return counters[slug] === 1 ? slug : `${slug}-${counters[slug]}`;
}

function lastQuotedValue(source, pattern) {
  let value = "";
  let match;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(source))) {
    value = match[1];
  }
  return value;
}

async function readDefaultProducts() {
  const source = await fs.readFile(path.join(publicDir, "script.js"), "utf8");
  const matcher =
    /item\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\)|bulk\(\s*\[([\s\S]*?)\]\s*,\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\s*\)/g;
  const counters = {};
  const products = [];
  let match;

  while ((match = matcher.exec(source))) {
    const before = source.slice(0, match.index);
    const collection = lastQuotedValue(before, /title:\s*"([^"]+)"/g) || "Catalogo";
    const category = lastQuotedValue(before, /name:\s*"([^"]+)"/g) || "Prodotti";

    if (match[1]) {
      const name = match[1];
      products.push({
        id: productIdForName(name, counters),
        name,
        original: match[2],
        finalPrice: match[3],
        discount: match[4],
        sizeType: match[5],
        collection,
        category,
        images: [],
      });
      continue;
    }

    const names = [...String(match[6] || "").matchAll(/"([^"]+)"/g)].map((nameMatch) => nameMatch[1]);
    names.forEach((name) => {
      products.push({
        id: productIdForName(name, counters),
        name,
        original: match[7],
        finalPrice: match[8],
        discount: match[9],
        sizeType: match[10],
        collection,
        category,
        images: [],
      });
    });
  }

  return products;
}

function mergeProduct(product, overrides) {
  const override = overrides[product.id] || {};
  const images = Array.isArray(override.images) ? override.images : product.images;
  const collection = override.collection || product.collection;
  const category = override.category || product.category;
  return {
    ...product,
    ...override,
    id: product.id,
    baseName: product.name,
    custom: false,
    collection,
    category,
    sizeType: resolveProductSizeType({
      collection,
      category,
      sizeType: override.sizeType || product.sizeType,
    }),
    images,
    originalImages: Array.isArray(override.originalImages)
      ? override.originalImages
      : Array.isArray(product.originalImages) ? product.originalImages : product.images,
    zoomImages: Array.isArray(override.zoomImages)
      ? override.zoomImages
      : Array.isArray(product.zoomImages) ? product.zoomImages : images,
    imageRenditions: cleanProductImageRenditions(override.imageRenditions, images),
  };
}

function cleanProductImages(images) {
  const source = Array.isArray(images) ? images : String(images || "").split(/\r?\n/);
  return source
    .map((image) => cleanTrackingString(image, 260))
    .filter(Boolean)
    .filter((image) => image.startsWith("assets/") || image.startsWith("/") || /^https?:\/\//i.test(image))
    .slice(0, maximumStoredProductImages);
}

function cleanProductImageRenditions(value, images = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowedImages = new Set(cleanProductImages(images));
  const clean = {};
  Object.entries(value).forEach(([source, entries]) => {
    const cleanSource = cleanProductImages([source])[0];
    if (!cleanSource || !allowedImages.has(cleanSource) || !Array.isArray(entries)) return;
    const seenWidths = new Set();
    const renditions = entries
      .map((entry) => {
        const url = cleanProductImages([entry?.url])[0];
        const width = Number(entry?.width);
        const height = Number(entry?.height);
        if (!url || !Number.isInteger(width) || width < 1 || width > 5000 || seenWidths.has(width)) return null;
        seenWidths.add(width);
        return {
          url,
          width,
          ...(Number.isInteger(height) && height > 0 && height <= 7000 ? { height } : {}),
          type: "image/webp",
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.width - right.width)
      .slice(0, productImageRenditionWidths.length);
    if (renditions.length) clean[cleanSource] = renditions;
  });
  return clean;
}

function cleanProductSizes(sizes) {
  const source = Array.isArray(sizes) ? sizes : String(sizes || "").split(/[\n,;]+/);
  return [...new Set(source.map((size) => cleanTrackingString(size, 12)).filter(Boolean))].slice(0, 20);
}

function cleanProductInventory(inventory) {
  if (inventory === "" || inventory === null || inventory === undefined) return null;
  const value = Number(inventory);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function cleanProductPatch(body) {
  const collection = cleanTrackingString(body.collection, 80);
  const category = cleanTrackingString(body.category, 80);
  const sizeType = resolveProductSizeType({
    collection,
    category,
    sizeType: body.sizeType,
  });
  const imageVariant = body.imageVariant === "cropped" ? "cropped" : "original";
  const images = cleanProductImages(body.images);
  const sizes = cleanProductSizes(body.sizes);
  const inventorySizes = sizes.length ? sizes : defaultProductSizes[sizeType];
  const inventoryBySize = normalizeInventoryBySize(body.inventoryBySize, inventorySizes);
  const sizeInventoryTotal = inventoryBySizeTotal(inventoryBySize);
  return {
    name: cleanTrackingString(body.name, 180) || "Prodotto",
    brand: cleanTrackingString(body.brand, 100),
    description: cleanTrackingString(body.description, 700),
    original: cleanTrackingString(body.original, 40),
    finalPrice: cleanTrackingString(body.finalPrice, 40),
    discount: cleanTrackingString(body.discount, 20),
    collection,
    category,
    sizeType,
    sizes,
    inventory: sizeInventoryTotal === null ? cleanProductInventory(body.inventory) : sizeInventoryTotal,
    inventoryBySize,
    images,
    originalImages: cleanProductImages(body.originalImages),
    zoomImages: cleanProductImages(body.zoomImages).length
      ? cleanProductImages(body.zoomImages)
      : images,
    imageRenditions: cleanProductImageRenditions(body.imageRenditions, images),
    imageVariant,
    updatedAt: new Date().toISOString(),
  };
}

function cleanCustomProduct(product, options = {}) {
  const patch = cleanProductPatch(product);
  const id = cleanTrackingString(product.id, 140) || `custom-${slugifyProduct(patch.name)}-${Date.now().toString(36)}`;
  const updatedAt = options.preserveUpdatedAt ? cleanTrackingString(product.updatedAt, 40) || patch.updatedAt : patch.updatedAt;
  return {
    id,
    custom: true,
    baseName: patch.name,
    createdAt: cleanTrackingString(product.createdAt, 40) || new Date().toISOString(),
    ...patch,
    updatedAt,
  };
}

function mergeCustomProduct(product) {
  const cleaned = cleanCustomProduct(product, { preserveUpdatedAt: true });
  return {
    ...cleaned,
    custom: true,
    baseName: cleaned.baseName || cleaned.name,
  };
}

function makeUniqueCustomProductId(name, overrides) {
  const base = `custom-${slugifyProduct(name)}`;
  const used = new Set([
    ...Object.keys(overrides.items || {}),
    ...(overrides.custom || []).map((product) => product.id),
  ]);
  let id = `${base}-${Date.now().toString(36)}`;
  let count = 2;
  while (used.has(id)) {
    id = `${base}-${Date.now().toString(36)}-${count}`;
    count += 1;
  }
  return id;
}

function formatAiPrice(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d,.-]/g, "").replace(".", "").replace(",", ".");
  const number = Number.parseFloat(normalized);
  if (!Number.isFinite(number) || number <= 0) return raw.replace("€", "").trim();
  return number.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function cleanAiSuggestion(suggestion, imageUrl) {
  const body = suggestion && typeof suggestion === "object" ? suggestion : {};
  const patch = cleanProductPatch({
    name: body.name,
    brand: body.brand,
    description: body.description,
    collection: body.collection,
    category: body.category,
    original: formatAiPrice(body.original),
    finalPrice: formatAiPrice(body.finalPrice),
    discount: body.discount,
    sizeType: body.sizeType,
    sizes: body.sizes,
    images: [imageUrl],
  });
  return {
    ...patch,
    confidence: cleanTrackingString(body.confidence, 40) || "media",
    sources: cleanAiSources(body.sources, patch.brand),
  };
}

function cleanAiSources(sources, brand) {
  const cleaned = Array.isArray(sources)
    ? sources.map((source) => cleanTrackingString(source, 220)).filter(Boolean).slice(0, 4)
    : [];
  if (!/louis\s*vuitton/i.test(String(brand || ""))) return cleaned;
  return cleaned.filter((source) => {
    try {
      return new URL(source).hostname.toLowerCase() === "it.louisvuitton.com";
    } catch {
      return false;
    }
  });
}

function responseOutputText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const chunks = [];
  const walk = (value) => {
    if (!value) return;
    if (typeof value === "string") {
      chunks.push(value);
      return;
    }
    if (Array.isArray(value)) return value.forEach(walk);
    if (typeof value !== "object") return;
    if (typeof value.text === "string") chunks.push(value.text);
    if (typeof value.output_text === "string") chunks.push(value.output_text);
    if (value.content) walk(value.content);
    if (value.output) walk(value.output);
  };
  walk(data?.output);
  return chunks.join("\n").trim();
}

function parseAiJson(text) {
  const raw = String(text || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error("Risposta AI non leggibile.");
  }
}

async function callOpenAiResponse(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), openaiTimeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: { message: text || "Risposta OpenAI non valida." } };
    }
    if (!response.ok) {
      const message = data?.error?.message || `OpenAI HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeProductImageWithAi(dataUrl) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["name", "brand", "description", "collection", "category", "original", "finalPrice", "discount", "sizeType", "sizes", "confidence", "sources"],
    properties: {
      name: { type: "string" },
      brand: { type: "string" },
      description: { type: "string" },
      collection: { type: "string" },
      category: { type: "string" },
      original: { type: "string" },
      finalPrice: { type: "string" },
      discount: { type: "string" },
      sizeType: { type: "string", enum: ["clothing", "sneakers", "none"] },
      sizes: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["alta", "media", "bassa"] },
      sources: { type: "array", items: { type: "string" } },
    },
  };
  const prompt = [
    "Analizza questa immagine prodotto per l'admin di Haller Boutique.",
    "Rileva prima la marca e usa la ricerca web per verificare marca, modello, titolo e caratteristiche del prodotto.",
    "Se riconosci la marca, usa come riferimento primario e obbligatorio solo il sito web ufficiale della marca: non usare marketplace, rivenditori, social network, Wikipedia, comparatori, blog o aggregatori per creare titolo e descrizione.",
    "REGOLA OBBLIGATORIA LOUIS VUITTON: se la marca rilevata e Louis Vuitton, incluso quando riconosci il monogramma LV, consulta e usa esclusivamente il sito italiano https://it.louisvuitton.com/ e pagine appartenenti al dominio it.louisvuitton.com. Non usare altre versioni nazionali, altri domini o fonti terze.",
    "Per Louis Vuitton non fermarti alla homepage: naviga e cerca all'interno di it.louisvuitton.com, apri le pagine di categoria, i risultati di ricerca interni e le schede prodotto pertinenti, quindi confronta modello, forma, materiali, colori, finiture e codice prodotto con cio che vedi nella foto.",
    "Per Louis Vuitton consulta piu pagine ufficiali quando disponibili e inserisci in sources fino a quattro pagine effettivamente aperte, dando priorita alla scheda esatta del prodotto. Se il modello esatto non e verificabile nelle pagine ufficiali, non inventarlo: usa un titolo generico Louis Vuitton basato sulla foto e indica solo caratteristiche confermate.",
    "Il campo sources deve contenere la pagina prodotto ufficiale consultata o, se non disponibile, una pagina pertinente dello stesso dominio ufficiale; non inserire fonti di terze parti.",
    "Scrivi il titolo in italiano mantenendo marca e nome ufficiale del modello verificati sul sito della marca.",
    "Scrivi la descrizione in italiano in modo originale, accurato e commerciale, usando i fatti trovati sul sito ufficiale ma senza copiare, tradurre letteralmente o riprodurre troppo da vicino la descrizione ufficiale.",
    "Se la marca e il suo sito ufficiale non sono verificabili, non usare fonti di terze parti: crea un titolo e una descrizione generici basati solo su ciò che è visibile nell'immagine e lascia sources vuoto.",
    "Non inventare marchi o modelli non riconoscibili: se non sei sicuro, usa un nome generico premium.",
    "Scegli collection tra Catalogo Uomo, Catalogo Donna o Selezione Haller Boutique.",
    "Scegli category in italiano. Per tutte le scarpe usa esattamente Scarpe, senza aggiungere Uomo o Donna; per gli altri prodotti usa ad esempio Borse Uomo, Borse Donna, T-Shirts Uomo, Giacche Uomo o Accessori.",
    "Per sizes restituisci solo le taglie ufficialmente previste per il modello quando sono verificabili sul sito della marca; altrimenti restituisci un array vuoto.",
    "Per original, finalPrice e discount restituisci sempre stringhe vuote: i prezzi vengono inseriti manualmente dall'admin.",
  ].join(" ");
  const basePayload = {
    model: openaiProductModel,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: dataUrl },
        ],
      },
    ],
  };
  const schemaPayload = {
    ...basePayload,
    tools: [{ type: "web_search_preview" }],
    text: {
      format: {
        type: "json_schema",
        name: "haller_product_suggestion",
        schema,
        strict: true,
      },
    },
  };

  let lastError;
  const attempts = [
    schemaPayload,
    { ...schemaPayload, tools: [{ type: "web_search" }] },
    {
      ...basePayload,
      tools: [{ type: "web_search_preview" }],
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: `${prompt} Rispondi solo con JSON valido con questi campi: ${Object.keys(schema.properties).join(", ")}.` },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
    },
  ];

  for (const payload of attempts) {
    try {
      const data = await callOpenAiResponse(payload);
      return parseAiJson(responseOutputText(data));
    } catch (error) {
      lastError = error;
      if (error.status && error.status !== 400) break;
    }
  }
  throw lastError || new Error("AI non disponibile.");
}

function fieldValue(parts, name, max = 260) {
  return cleanTrackingString(parts.find((part) => part.name === name)?.data.toString("utf8"), max);
}

function imageMimeFromExtension(ext) {
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function appendImageFormData(form, field, image) {
  form.append(field, new Blob([image.data], { type: image.mime }), image.filename);
}

function buildTryOnForm({ userImage, productImages = [], productName, category, bundleItems = [] }) {
  const form = new FormData();
  const hasSeparateProductImages = productImages.length > 0;
  if (hasSeparateProductImages) {
    // Multiple inputs must use OpenAI's multipart array syntax. Repeating the
    // scalar `image` field is rejected as a duplicate parameter.
    appendImageFormData(form, "image[]", userImage);
    productImages.forEach((image) => appendImageFormData(form, "image[]", image));
  } else {
    appendImageFormData(form, "image", userImage);
  }
  form.append("model", openaiTryOnModel);
  form.append("size", bundleItems.length > 0 || hasSeparateProductImages ? "1024x1536" : "1024x1024");
  form.append("quality", "high");
  form.append("output_format", "jpeg");
  form.append("output_compression", "94");
  if (openaiTryOnModel !== "gpt-image-2") form.append("input_fidelity", "high");
  const identityLock = [
    "PERSON LOCK — highest priority: input image 1 is the immutable identity and scene reference.",
    "Do not modify, redraw, regenerate, retouch, beautify, sharpen, blur or reinterpret the customer's head, face, facial geometry, eyes, eyebrows, nose, mouth, teeth, jaw, ears, skin tone, skin texture, expression or hair.",
    "Preserve the exact identity, likeness, age, body shape, pose, hands, camera angle, framing, lighting and background from input image 1.",
    "If any fashion-product instruction conflicts with identity preservation, preserve the person and adapt only the product.",
  ].join(" ");
  const tryOnPrompt = bundleItems.length > 0
    ? [
        "Edit input image 1 to create one photorealistic virtual try-on preview for an ecommerce fashion checkout.",
        identityLock,
        `Product instructions in checkout order: ${bundleItems.map((item, index) => item.referenceImageIndices?.[0] > 0
          ? `input image ${item.referenceImageIndices[0]} = item ${index + 1}, ${item.name} (${item.category || item.sizeType || "fashion"})`
          : `item ${index + 1} = ${item.name} (${item.category || item.sizeType || "fashion"}), with no catalog photo available; use the product name and category as the reference`).join("; ")}.`,
        "Checkout product rule — highest priority after PERSON LOCK: the referenced products may be clothing, footwear, bags or accessories, with a strict maximum of two products.",
        "Allowed change: replace only the pixels in each referenced product's natural wearing or carrying area. Keep every other pixel and visual attribute from input image 1 unchanged.",
        "For a footwear product, replace the customer's existing footwear with a realistic matching pair of the referenced model on both feet. Preserve the exact feet position, leg pose and visible socks unless the referenced footwear naturally covers them.",
        "Use every referenced product exactly once. Do not omit, replace, redesign, duplicate or invent any product.",
        "Layer garments naturally on the body; fit footwear naturally to both feet; carry bags naturally in the hand, over the shoulder or across the body; place accessories in their natural position.",
        "Use each selected product's first original catalog photo as the authoritative visual reference. Preserve the exact product type, color, logo, print, material, cut, proportions, shape and visible details.",
        "Catalog photos may also show boxes, packaging, cards, mannequins, stands, background props or products that were not referenced. Ignore every unreferenced item and background prop completely.",
        "Preserve the original framing, including the full body and both feet when visible. Never reframe, rescale or extend the image, and never alter the head, face, body proportions or pose.",
        "Return one premium, photorealistic fashion try-on preview. Do not return a collage, split screen, labels or product panels.",
      ].join(" ")
    : hasSeparateProductImages
      ? [
          "Edit input image 1 to create a photorealistic virtual try-on preview for an ecommerce fashion site.",
          identityLock,
          "Input image 2 is the authoritative first original catalog photo of the product.",
          `Product name: ${productName || "Haller Boutique product"}. Category: ${category || "fashion"}.`,
          "Allowed change: replace only the product's natural wearing or carrying area needed to put the product from input image 2 on the existing person. Keep everything else the same.",
          "Preserve the product's exact type, color, logo, print, material, cut, proportions, shape and visible details. Ignore packaging, cards, stands, mannequins and background props in the product photo.",
          "Fit the product naturally to the customer's existing pose and body geometry with realistic material behavior, lighting, shadows and color temperature.",
          "If the referenced product is footwear, replace the customer's current footwear with a realistic matching pair on both feet while preserving exact foot placement, leg pose and visible socks. Otherwise preserve the customer's existing footwear.",
          "Do not change the background, camera angle, framing, image quality or any part of the face. Do not add unrelated accessories, text, logos or watermarks.",
          "Return one premium photorealistic portrait, never a collage or split screen.",
        ].join(" ")
    : [
        "Edit input image 1 to create a realistic virtual try-on preview for an ecommerce fashion site.",
        identityLock,
        "No catalog product photo is available. Use the supplied product name and category as the authoritative product description.",
        `Product name: ${productName || "Haller Boutique product"}. Category: ${category || "fashion"}.`,
        "Put the described product on the customer while preserving the exact person, pose, lighting, framing and background.",
        "Footwear products are supported: replace the customer's current footwear with a realistic matching pair on both feet. For a bag, show it carried naturally in the hand, over the shoulder or across the body and keep it fully visible.",
        "Only change the natural wearing or carrying area needed for the product. Do not create nudity. Do not change age, face, body proportions or add unrelated logos.",
        "Return a premium, realistic square preview suitable for a product try-on modal.",
      ].join(" ");
  form.append(
    "prompt",
    tryOnPrompt
  );
  return form;
}

async function requestTryOnEdit(form) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), openaiTryOnTimeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: form,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: { message: text || "Risposta OpenAI non valida." } };
    }
    if (!response.ok) {
      const error = new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const output = data?.data?.[0];
    if (output?.b64_json) return `data:image/jpeg;base64,${output.b64_json}`;
    if (output?.url) return output.url;
    throw new Error("Immagine try-on non ricevuta.");
  } finally {
    clearTimeout(timeout);
  }
}

async function generateTryOnImage(input) {
  return requestTryOnEdit(buildTryOnForm(input));
}

function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  try {
    if (!token || !token.includes(".")) return null;
    const [body, sig] = token.split(".");
    const expected = createHmac("sha256", sessionSecret).update(body).digest("base64url");
    const left = Buffer.from(sig);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookie(name, value, maxAge) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

function clearCookie(name) {
  return cookie(name, "", 0);
}

function sessionCookie(userId) {
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return cookie("hb_session", signPayload({ sub: userId, exp: Date.now() + thirtyDays }), thirtyDays / 1000);
}

function pkceVerifierCookie(verifier) {
  return cookie("hb_oauth_verifier", verifier, 600);
}

function adminCookie() {
  const twelveHours = 12 * 60 * 60 * 1000;
  return cookie("hb_admin", signPayload({ role: "admin", exp: Date.now() + twelveHours }), twelveHours / 1000);
}

function mobileAdminToken() {
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const expiresAt = Date.now() + thirtyDays;
  return {
    token: signPayload({ role: "admin", audience: "mobile", exp: expiresAt }),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function anonCookie(visitorId) {
  const sixMonths = 180 * 24 * 60 * 60;
  return cookie("hb_anon", visitorId, sixMonths);
}

function cleanAnonId(value) {
  const id = cleanTrackingString(value, 80);
  return /^anon_[a-f0-9]{24}$/.test(id) ? id : "";
}

function getUserId(req) {
  return verifyToken(parseCookies(req).hb_session)?.sub || null;
}

function isAdmin(req) {
  return verifyToken(parseCookies(req).hb_admin)?.role === "admin";
}

function bearerToken(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function isMobileAdmin(req) {
  const payload = verifyToken(bearerToken(req));
  return payload?.role === "admin" && payload?.audience === "mobile";
}

function adminPasswordMatches(candidate) {
  const provided = Buffer.from(String(candidate || ""));
  const expected = Buffer.from(String(adminPassword || ""));
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    provider: user.provider,
    providers: user.providers || [user.provider],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function cleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `${salt}.${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(".")) return false;
  const [salt, hash] = stored.split(".");
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "base64url");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("application/json")) return JSON.parse(raw);
  return Object.fromEntries(new URLSearchParams(raw));
}

async function readRequestBuffer(req, maxBytes = 35 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("File troppo grande.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipartBuffer(buffer, boundary) {
  const marker = `--${boundary}`;
  return buffer
    .toString("latin1")
    .split(marker)
    .slice(1, -1)
    .map((part) => {
      const normalized = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
      const splitAt = normalized.indexOf("\r\n\r\n");
      if (splitAt === -1) return null;
      const rawHeaders = normalized.slice(0, splitAt);
      const body = normalized.slice(splitAt + 4);
      const disposition = rawHeaders.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || "";
      return {
        name: disposition.match(/name="([^"]+)"/i)?.[1] || "",
        filename: disposition.match(/filename="([^"]*)"/i)?.[1] || "",
        contentType: rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "",
        data: Buffer.from(body, "latin1"),
      };
    })
    .filter(Boolean);
}

function imageExtension(filename, contentType) {
  const byType = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };
  const ext = path.extname(String(filename || "")).toLowerCase();
  if (publicAssetExtensions.has(ext) && ext !== ".ico") return ext === ".jpeg" ? ".jpg" : ext;
  return byType[String(contentType || "").toLowerCase()] || "";
}

function imageDataFromDataUrl(value) {
  const match = String(value || "").match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  const ext = imageExtension("preview", match[1]);
  if (!ext) return null;
  return { data: Buffer.from(match[2], "base64"), ext };
}

async function archiveTryOn({ customerImage, generated, productId, productName, category }) {
  const sourceExt = imageExtension(customerImage.filename, customerImage.contentType);
  if (!sourceExt || sourceExt === ".svg" || customerImage.data.length === 0) return null;

  const id = `tryon_${Date.now()}_${randomBytes(6).toString("hex")}`;
  const sourceFile = `${id}-source${sourceExt}`;
  const preview = imageDataFromDataUrl(generated);
  const previewFile = preview ? `${id}-preview${preview.ext}` : "";
  await fs.mkdir(tryOnDir, { recursive: true });
  await fs.writeFile(path.join(tryOnDir, sourceFile), customerImage.data);
  if (previewFile) await fs.writeFile(path.join(tryOnDir, previewFile), preview.data);

  const createdAt = new Date().toISOString();
  const record = {
    id,
    createdAt,
    expiresAt: new Date(Date.now() + tryOnRetentionMs).toISOString(),
    productId: cleanTrackingString(productId, 120),
    productName: cleanTrackingString(productName, 180),
    category: cleanTrackingString(category, 120),
    sourceFile,
    previewFile,
  };
  const records = await pruneTryOnArchive();
  records.unshift(record);
  await writeJson(tryOnArchiveFile, records.slice(0, 100));
  return record;
}

function origin(req) {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers.host}`;
}

function providerConfigured(provider) {
  return oauthProviders[provider].env.every((key) => Boolean(process.env[key]));
}

function providerStatus() {
  return Object.fromEntries(
    Object.entries(oauthProviders).map(([key, provider]) => [
      key,
      { label: provider.label, configured: providerConfigured(key) },
    ])
  );
}

async function upsertOauthUser(profile) {
  const now = new Date().toISOString();
  const users = await readUsers();
  const email = cleanEmail(profile.email);
  let user = users.find((entry) => entry.email === email);
  if (user) {
    user.name = profile.name || user.name;
    user.provider = user.provider || profile.provider;
    user.providers = Array.from(new Set([...(user.providers || [user.provider]), profile.provider]));
    user.oauth = { ...(user.oauth || {}), [profile.provider]: profile.providerId };
    user.updatedAt = now;
    user.lastLoginAt = now;
  } else {
    user = {
      id: `usr_${randomBytes(12).toString("hex")}`,
      name: profile.name || email.split("@")[0],
      email,
      phone: "",
      provider: profile.provider,
      providers: [profile.provider],
      oauth: { [profile.provider]: profile.providerId },
      passwordHash: "",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };
    users.push(user);
  }
  await writeUsers(users);
  return user;
}

async function handleRegister(req, res) {
  const body = await parseBody(req);
  const email = cleanEmail(body.email);
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const password = String(body.password || "");
  if (!name) return badRequest(res, "Inserisci nome e cognome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest(res, "Inserisci una email valida.");
  if (password.length < 8) return badRequest(res, "La password deve avere almeno 8 caratteri.");

  const users = await readUsers();
  if (users.some((user) => user.email === email)) return badRequest(res, "Email gia registrata.");

  const now = new Date().toISOString();
  const user = {
    id: `usr_${randomBytes(12).toString("hex")}`,
    name,
    email,
    phone,
    provider: "email",
    providers: ["email"],
    oauth: {},
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  users.push(user);
  await writeUsers(users);
  json(res, 201, { ok: true, user: publicUser(user) }, { "Set-Cookie": sessionCookie(user.id) });
}

async function handleLogin(req, res) {
  const body = await parseBody(req);
  const email = cleanEmail(body.email);
  const password = String(body.password || "");
  const users = await readUsers();
  const user = users.find((entry) => entry.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return json(res, 401, { ok: false, message: "Email o password non corretti." });
  }
  user.lastLoginAt = new Date().toISOString();
  user.updatedAt = user.lastLoginAt;
  await writeUsers(users);
  json(res, 200, { ok: true, user: publicUser(user) }, { "Set-Cookie": sessionCookie(user.id) });
}

async function handleMe(req, res) {
  const userId = getUserId(req);
  if (!userId) return json(res, 200, { ok: true, user: null });
  const users = await readUsers();
  const user = users.find((entry) => entry.id === userId);
  json(res, 200, { ok: true, user: user ? publicUser(user) : null });
}

async function handleAdminLogin(req, res) {
  const body = await parseBody(req);
  if (!adminPassword) return json(res, 503, { ok: false, message: "Password admin non configurata." });
  if (!adminPasswordMatches(body.password)) return json(res, 401, { ok: false, message: "Password admin non corretta." });
  json(res, 200, { ok: true }, { "Set-Cookie": adminCookie() });
}

async function handleAdminUsers(req, res) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: "Accesso admin richiesto." });
  const users = await readUsers();
  json(res, 200, {
    ok: true,
    users: users
      .map(publicUser)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  });
}

async function handleMobileAdminLogin(req, res) {
  const body = await parseBody(req);
  if (!adminPassword) return json(res, 503, { ok: false, message: "Password admin non configurata." });
  if (!adminPasswordMatches(body.password)) {
    return json(res, 401, { ok: false, message: "Password admin non corretta." });
  }
  const session = mobileAdminToken();
  json(res, 200, { ok: true, ...session });
}

function mobileOrderStatusFilter(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "new" || normalized === "nuovo") return ORDER_STATUS.NEW;
  if (normalized === "confirmed" || normalized === "confermato") return ORDER_STATUS.CONFIRMED;
  if (normalized === "rejected" || normalized === "rifiutato") return ORDER_STATUS.REJECTED;
  return "";
}

async function handleMobileAdminOrders(req, res, url) {
  if (!isMobileAdmin(req)) return json(res, 401, { ok: false, message: "Sessione scaduta. Accedi di nuovo." });
  const orders = await readOrders();
  const status = mobileOrderStatusFilter(url.searchParams.get("status"));
  const limit = Math.max(1, Math.min(500, Number.parseInt(url.searchParams.get("limit") || "200", 10) || 200));
  const rows = orders
    .filter((order) => !status || (order.status || ORDER_STATUS.NEW) === status)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, limit)
    .map(publicMobileOrder);
  json(res, 200, { ok: true, orders: rows });
}

async function handleMobileAdminOrder(req, res, orderId) {
  if (!isMobileAdmin(req)) return json(res, 401, { ok: false, message: "Sessione scaduta. Accedi di nuovo." });
  const cleanOrderId = cleanTrackingString(orderId, 100);
  if (!/^ord_[a-zA-Z0-9_-]+$/.test(cleanOrderId)) return badRequest(res, "Ordine non valido.");

  if (req.method === "GET") {
    const orders = await readOrders();
    const order = orders.find((entry) => entry.id === cleanOrderId);
    if (!order) return json(res, 404, { ok: false, message: "Ordine non trovato." });
    return json(res, 200, { ok: true, order: publicMobileOrder(order) });
  }

  if (req.method !== "PATCH") return json(res, 405, { ok: false, message: "Metodo non consentito." });
  const body = await parseBody(req);
  const targetStatus = mobileOrderStatusFilter(body.status);
  if (![ORDER_STATUS.CONFIRMED, ORDER_STATUS.REJECTED].includes(targetStatus)) {
    return badRequest(res, "Scegli Confermato o Rifiutato.");
  }

  try {
    const updatedOrder = await enqueueOrderMutation(async () => {
      const orders = await readOrders();
      const index = orders.findIndex((entry) => entry.id === cleanOrderId);
      if (index === -1) return null;
      const result = transitionOrder(orders[index], targetStatus);
      if (result.changed && result.inventoryDelta > 0) {
        await enqueueProductMutation(() => restoreProductInventory(result.order.products));
      }
      orders[index] = result.order;
      await writeOrders(orders);
      return result.order;
    });
    if (!updatedOrder) return json(res, 404, { ok: false, message: "Ordine non trovato." });
    return json(res, 200, { ok: true, order: publicMobileOrder(updatedOrder) });
  } catch (error) {
    if (error?.code === "INVALID_TRANSITION") return json(res, 409, { ok: false, message: error.message });
    if (error?.code === "INVALID_STATUS") return badRequest(res, error.message);
    throw error;
  }
}

async function handleMobileShippingLabel(req, res, orderId) {
  if (!isMobileAdmin(req)) return json(res, 401, { ok: false, message: "Sessione scaduta. Accedi di nuovo." });
  if (req.method !== "GET") return json(res, 405, { ok: false, message: "Metodo non consentito." });
  const cleanOrderId = cleanTrackingString(orderId, 100);
  if (!/^ord_[a-zA-Z0-9_-]+$/.test(cleanOrderId)) return badRequest(res, "Ordine non valido.");

  const orders = await readOrders();
  const order = orders.find((entry) => entry.id === cleanOrderId);
  if (!order) return json(res, 404, { ok: false, message: "Ordine non trovato." });

  try {
    const label = buildShippingLabel(order);
    const qrCodeDataUrl = await QRCode.toDataURL(shippingLabelQrPayload(label), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    const html = renderShippingLabelHtml(label, qrCodeDataUrl);
    return json(res, 200, {
      ok: true,
      label: {
        orderId: label.orderId,
        orderCode: label.orderCode,
        generatedAt: label.generatedAt,
        html,
      },
    });
  } catch (error) {
    if (error?.code === "ORDER_NOT_CONFIRMED") return json(res, 409, { ok: false, message: error.message });
    throw error;
  }
}

async function handleMobileAdminDashboard(req, res) {
  if (!isMobileAdmin(req)) return json(res, 401, { ok: false, message: "Sessione scaduta. Accedi di nuovo." });
  const orders = await readOrders();
  json(res, 200, { ok: true, dashboard: buildOrdersDashboard(orders) });
}

async function handleMobilePushToken(req, res) {
  if (!isMobileAdmin(req)) return json(res, 401, { ok: false, message: "Sessione scaduta. Accedi di nuovo." });
  const body = await parseBody(req);

  if (req.method === "DELETE") {
    const token = String(body.token || "").trim();
    await enqueuePushSubscriptionMutation(async () => {
      const subscriptions = await readPushSubscriptions();
      await writePushSubscriptions(subscriptions.filter((entry) => entry.token !== token));
    });
    return json(res, 200, { ok: true });
  }

  if (req.method !== "POST") return json(res, 405, { ok: false, message: "Metodo non consentito." });
  const subscription = normalizePushSubscription(body);
  if (!subscription) return badRequest(res, "Token notifiche non valido.");
  await enqueuePushSubscriptionMutation(async () => {
    const subscriptions = await readPushSubscriptions();
    const next = subscriptions.filter((entry) => entry.token !== subscription.token);
    next.push(subscription);
    await writePushSubscriptions(next);
  });
  setTimeout(() => processMobilePushNotifications().catch((error) => {
    console.error(`[push] Queue after device registration failed: ${error.message}`);
  }), 0);
  json(res, 200, { ok: true });
}

async function handleProducts(req, res) {
  const data = await readProductOverrides();
  const toPublicProduct = (product) => {
    const { inventory, inventoryBySize, ...publicProduct } = product || {};
    const normalizedInventoryBySize = normalizeInventoryBySize(inventoryBySize);
    const inventoryTrackedBySize = Object.keys(normalizedInventoryBySize).length > 0;
    const inventoryTotal = productInventoryTotal({ inventory, inventoryBySize: normalizedInventoryBySize });
    return {
      ...publicProduct,
      zoomImages: cleanProductImages(publicProduct.zoomImages).map(productZoomDeliveryPath),
      inventoryTrackedBySize,
      availableSizes: inventoryTrackedBySize
        ? availableInventorySizes({ inventoryBySize: normalizedInventoryBySize })
        : [],
      isSoldOut: inventoryTotal === 0,
      isLastAvailable: inventoryTotal === 1,
    };
  };
  const items = Object.fromEntries(Object.entries(data.items).map(([id, product]) => [id, toPublicProduct(product)]));
  json(res, 200, { ok: true, items, custom: data.custom.map(mergeCustomProduct).map(toPublicProduct) }, {
    "Cache-Control": "private, no-store",
  });
}

function cleanChatMessage(value) {
  return cleanTrackingString(value, 900);
}

const siteChatLanguages = {
  it: { name: "italiano", locale: "it-IT", invalidProfile: "Inserisci nome, cognome e un indirizzo email valido per continuare.", emptyMessage: "Scrivi un messaggio per iniziare la conversazione.", unavailable: "Assistente virtuale temporaneamente non disponibile.", fallback: "Mi e sfuggito un dettaglio. Puoi riscriverlo un attimo?" },
  en: { name: "English", locale: "en-GB", invalidProfile: "Enter your first name, last name and a valid email address to continue.", emptyMessage: "Write a message to start the conversation.", unavailable: "The virtual assistant is temporarily unavailable.", fallback: "I missed a detail. Could you rephrase that?" },
  fr: { name: "francais", locale: "fr-FR", invalidProfile: "Saisissez votre prenom, votre nom et une adresse e-mail valide pour continuer.", emptyMessage: "Ecrivez un message pour commencer la conversation.", unavailable: "L'assistante virtuelle est temporairement indisponible.", fallback: "Un detail m'a echappe. Pouvez-vous reformuler ?" },
  de: { name: "Deutsch", locale: "de-DE", invalidProfile: "Geben Sie Vorname, Nachname und eine gultige E-Mail-Adresse ein.", emptyMessage: "Schreiben Sie eine Nachricht, um das Gesprach zu beginnen.", unavailable: "Der virtuelle Assistent ist vorubergehend nicht verfugbar.", fallback: "Mir ist ein Detail entgangen. Konnen Sie das bitte anders formulieren?" },
  es: { name: "espanol", locale: "es-ES", invalidProfile: "Introduce tu nombre, apellidos y un correo valido para continuar.", emptyMessage: "Escribe un mensaje para iniciar la conversacion.", unavailable: "La asistente virtual no esta disponible temporalmente.", fallback: "Se me ha escapado un detalle. Puedes reformularlo?" },
  sq: { name: "shqip", locale: "sq-AL", invalidProfile: "Vendosni emrin, mbiemrin dhe nje adrese email te vlefshme per te vazhduar.", emptyMessage: "Shkruani nje mesazh per te filluar biseden.", unavailable: "Asistentja virtuale nuk eshte perkohesisht e disponueshme.", fallback: "Me shpetoi nje detaj. Mund ta riformuloni?" },
  ro: { name: "română", locale: "ro-RO", invalidProfile: "Introdu prenumele, numele si o adresa de e-mail valida pentru a continua.", emptyMessage: "Scrie un mesaj pentru a incepe conversatia.", unavailable: "Asistenta virtuala este temporar indisponibila.", fallback: "Mi-a scapat un detaliu. Poti reformula?" },
};

const tryOnLanguages = {
  it: { notConfigured: "Try-on AI non configurato.", upload: "Carica una tua foto.", format: "Formato immagine non supportato. Usa JPG, PNG o WebP.", bundleImages: "Servono le foto originali di tutti i prodotti del bundle.", bundleRules: "Il try-on accetta tutti gli articoli, con massimo 2 prodotti.", billing: "Credito API OpenAI esaurito: ricarica il saldo o aumenta il limite di spesa per riattivare il try-on.", received: "Foto ricevuta", prepared: "Prodotto reale del catalogo preparato", generating: "Generazione try-on AI in corso", preview: "Anteprima ricevuta", bundlePrepared: "I prodotti selezionati sono pronti", bundleGenerating: "Generazione try-on in corso", bundlePreview: "Try-on ricevuto", timeout: "La generazione ha impiegato troppo tempo. Riprova.", busy: "Il servizio try-on e momentaneamente occupato. Riprova tra poco.", rejected: "Una delle immagini non puo essere elaborata. Usa foto JPG, PNG o WebP nitide.", unavailable: "Try-on non disponibile." },
  en: { notConfigured: "AI try-on is not configured.", upload: "Upload your photo.", format: "Unsupported image format. Use JPG, PNG or WebP.", bundleImages: "The original photos for every bundle product are required.", bundleRules: "Try-on accepts every product, with a maximum of 2 products.", billing: "OpenAI API credit is exhausted. Add credit or raise the spending limit to reactivate try-on.", received: "Photo received", prepared: "Real catalog product prepared", generating: "Generating the AI try-on", preview: "Preview received", bundlePrepared: "The selected products are ready", bundleGenerating: "Generating the try-on", bundlePreview: "Try-on received", timeout: "Generation took too long. Please try again.", busy: "The try-on service is temporarily busy. Please try again shortly.", rejected: "One of the images cannot be processed. Use a clear JPG, PNG or WebP photo.", unavailable: "Try-on is unavailable." },
  fr: { notConfigured: "L'essayage IA n'est pas configure.", upload: "Importez votre photo.", format: "Format d'image non pris en charge. Utilisez JPG, PNG ou WebP.", bundleImages: "Les photos originales de chaque produit du bundle sont requises.", bundleRules: "L'essayage accepte tous les produits, avec un maximum de 2 produits.", billing: "Le credit API OpenAI est epuise. Ajoutez du credit ou augmentez la limite de depenses.", received: "Photo reçue", prepared: "Produit reel du catalogue prepare", generating: "Generation de l'essayage IA", preview: "Aperçu reçu", bundlePrepared: "Les produits selectionnes sont prets", bundleGenerating: "Generation de l'essayage", bundlePreview: "Essayage reçu", timeout: "La generation a pris trop de temps. Reessayez.", busy: "Le service d'essayage est momentanement occupe. Reessayez bientot.", rejected: "Une image ne peut pas etre traitee. Utilisez une photo JPG, PNG ou WebP nette.", unavailable: "L'essayage est indisponible." },
  de: { notConfigured: "Die KI-Anprobe ist nicht konfiguriert.", upload: "Laden Sie Ihr Foto hoch.", format: "Nicht unterstutztes Bildformat. Verwenden Sie JPG, PNG oder WebP.", bundleImages: "Die Originalfotos aller Bundle-Produkte sind erforderlich.", bundleRules: "Die Anprobe akzeptiert alle Produkte und maximal 2 Produkte.", billing: "Das OpenAI-API-Guthaben ist aufgebraucht. Laden Sie Guthaben auf oder erhohen Sie das Ausgabenlimit.", received: "Foto empfangen", prepared: "Reales Katalogprodukt vorbereitet", generating: "KI-Anprobe wird erstellt", preview: "Vorschau empfangen", bundlePrepared: "Die ausgewahlten Produkte sind bereit", bundleGenerating: "Anprobe wird erstellt", bundlePreview: "Anprobe empfangen", timeout: "Die Generierung hat zu lange gedauert. Versuchen Sie es erneut.", busy: "Der Anprobe-Service ist vorubergehend ausgelastet. Versuchen Sie es gleich noch einmal.", rejected: "Ein Bild kann nicht verarbeitet werden. Verwenden Sie ein klares JPG-, PNG- oder WebP-Foto.", unavailable: "Die Anprobe ist nicht verfugbar." },
  es: { notConfigured: "La prueba con IA no esta configurada.", upload: "Sube tu foto.", format: "Formato de imagen no compatible. Usa JPG, PNG o WebP.", bundleImages: "Se necesitan las fotos originales de todos los productos del conjunto.", bundleRules: "La prueba acepta todos los productos, con un maximo de 2 productos.", billing: "El credito de la API de OpenAI esta agotado. Anade credito o aumenta el limite de gasto.", received: "Foto recibida", prepared: "Producto real del catalogo preparado", generating: "Generando la prueba con IA", preview: "Vista previa recibida", bundlePrepared: "Los productos seleccionados estan listos", bundleGenerating: "Generando la prueba", bundlePreview: "Prueba recibida", timeout: "La generacion ha tardado demasiado. Vuelve a intentarlo.", busy: "El servicio de prueba esta ocupado temporalmente. Intentalo de nuevo en breve.", rejected: "Una imagen no se puede procesar. Usa una foto JPG, PNG o WebP nitida.", unavailable: "La prueba no esta disponible." },
  sq: { notConfigured: "Prova me AI nuk eshte konfiguruar.", upload: "Ngarkoni foton tuaj.", format: "Formati i imazhit nuk mbeshtetet. Perdorni JPG, PNG ose WebP.", bundleImages: "Nevojiten fotot origjinale te te gjitha produkteve te bundle-it.", bundleRules: "Prova pranon te gjitha produktet, me maksimumi 2 produkte.", billing: "Krediti i API-se OpenAI ka mbaruar. Shtoni kredit ose rrisni kufirin e shpenzimeve.", received: "Fotoja u mor", prepared: "Produkti real i katalogut u pergatit", generating: "Po gjenerohet prova me AI", preview: "Pamja paraprake u mor", bundlePrepared: "Produktet e zgjedhura jane gati", bundleGenerating: "Po gjenerohet prova", bundlePreview: "Prova u mor", timeout: "Gjenerimi zgjati shume. Provoni perseri.", busy: "Sherbimi i proves eshte perkohesisht i zene. Provoni perseri pas pak.", rejected: "Nje nga imazhet nuk mund te perpunohen. Perdorni nje foto te qarte JPG, PNG ose WebP.", unavailable: "Prova nuk eshte e disponueshme." },
  ro: { notConfigured: "Proba AI nu este configurata.", upload: "Incarca fotografia ta.", format: "Format de imagine neacceptat. Foloseste JPG, PNG sau WebP.", bundleImages: "Sunt necesare fotografiile originale ale tuturor produselor din bundle.", bundleRules: "Proba accepta toate produsele, cu maximum 2 produse.", billing: "Creditul API OpenAI este epuizat. Adauga credit sau mareste limita de cheltuieli.", received: "Fotografie primita", prepared: "Produsul real din catalog este pregatit", generating: "Se genereaza proba AI", preview: "Previzualizare primita", bundlePrepared: "Produsele selectate sunt gata", bundleGenerating: "Se genereaza proba", bundlePreview: "Proba a fost primita", timeout: "Generarea a durat prea mult. Incearca din nou.", busy: "Serviciul de proba este temporar ocupat. Incearca din nou in curand.", rejected: "Una dintre imagini nu poate fi procesata. Foloseste o fotografie clara JPG, PNG sau WebP.", unavailable: "Proba nu este disponibila." },
};

function tryOnFailureMessage(error, copy) {
  if (error?.name === "AbortError") return copy.timeout;
  const message = String(error?.message || "");
  if (/billing hard limit|billing_hard_limit_reached|insufficient[_ -]?quota|credit balance/i.test(message)) return copy.billing;
  const status = Number(error?.status || 0);
  if (status === 400 || status === 413 || status === 415) return copy.rejected;
  if (status === 408 || status === 429 || status >= 500) return copy.busy;
  return copy.unavailable;
}

function cleanTryOnRequestId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{16,120}$/.test(id) ? id : "";
}

function pruneTryOnJobs() {
  const cutoff = Date.now() - tryOnJobRetentionMs;
  for (const [id, job] of tryOnJobs) {
    if (job.updatedAt < cutoff) tryOnJobs.delete(id);
  }
  for (const [requestId, entry] of tryOnRequestJobs) {
    if (entry.createdAt < cutoff || !tryOnJobs.has(entry.jobId)) tryOnRequestJobs.delete(requestId);
  }
}

function publicTryOnJob(job) {
  const payload = {
    ok: job.state !== "failed",
    jobId: job.id,
    state: job.state,
    progress: job.progress,
    message: job.message,
  };
  if (job.state === "completed") return { ...payload, ...job.result };
  return payload;
}

function startTryOnJob({ userImage, productImages, productName, category, bundleItems, mode, saveTryOn, customerImage, productId, copy }) {
  pruneTryOnJobs();
  const activeJobs = [...tryOnJobs.values()].filter((job) => job.state === "queued" || job.state === "running").length;
  if (activeJobs >= tryOnMaxActiveJobs) return null;

  const id = `tryon-job-${randomBytes(18).toString("hex")}`;
  const job = {
    id,
    state: "queued",
    progress: 24,
    message: copy.received,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    result: null,
  };
  tryOnJobs.set(id, job);

  void (async () => {
    try {
      job.state = "running";
      job.progress = 60;
      job.message = mode === "bundle" ? copy.bundleGenerating : copy.generating;
      job.updatedAt = Date.now();
      const generated = await generateTryOnImage({ userImage, productImages, productName, category, bundleItems });
      job.progress = 92;
      job.message = mode === "bundle" ? copy.bundlePreview : copy.preview;
      job.updatedAt = Date.now();
      const archived = saveTryOn && customerImage
        ? await archiveTryOn({ customerImage, generated, productId, productName, category })
        : null;
      job.state = "completed";
      job.progress = 100;
      job.message = mode === "bundle" ? copy.bundlePreview : copy.preview;
      job.result = { image: generated, saved: Boolean(archived), mode };
      job.updatedAt = Date.now();
    } catch (error) {
      job.state = "failed";
      job.progress = 100;
      job.message = tryOnFailureMessage(error, copy);
      job.updatedAt = Date.now();
      console.error("[try-on] asynchronous generation failed", {
        jobId: job.id,
        mode,
        itemCount: bundleItems.length,
        itemIds: bundleItems.map((item) => item.id),
        status: Number(error?.status || 0),
        error: cleanTrackingString(error?.message, 220),
      });
    }
  })();

  return job;
}

function handleTryOnJob(req, res, jobId) {
  if (req.method !== "GET") return notFound(res);
  pruneTryOnJobs();
  const job = tryOnJobs.get(jobId);
  if (!job) return json(res, 404, { ok: false, state: "missing", message: tryOnLanguages.it.unavailable });
  const status = job.state === "failed" ? 502 : 200;
  return json(res, status, publicTryOnJob(job), job.state === "completed" || job.state === "failed" ? {} : { "Retry-After": "2" });
}

function siteChatLanguage(value) {
  const code = cleanTrackingString(value, 8).toLowerCase();
  return Object.hasOwn(siteChatLanguages, code) ? code : "it";
}

function cleanTryOnBundleItems(value) {
  try {
    const items = JSON.parse(String(value || ""));
    if (!Array.isArray(items)) return [];
    return items
      .slice(0, 3)
      .map((item) => ({
        id: cleanTrackingString(item?.id, 120),
        name: cleanTrackingString(item?.name, 140),
        category: cleanTrackingString(item?.category, 100),
        sizeType: cleanTrackingString(item?.sizeType, 40),
        referenceImageIndices: Array.isArray(item?.referenceImageIndices)
          ? [...new Set(item.referenceImageIndices
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 2))]
            .slice(0, 1)
          : item?.referenceImageIndex === 0
            ? []
          : Number.isInteger(Number(item?.referenceImageIndex))
            ? [Number(item.referenceImageIndex)]
            : null,
      }))
      .filter((item) => item.name);
  } catch {
    return [];
  }
}

function cleanChatCatalog(catalog) {
  if (!Array.isArray(catalog)) return [];
  return catalog
    .slice(0, 80)
    .map((product) => ({
      name: cleanTrackingString(product?.name, 120),
      category: cleanTrackingString(product?.category, 80),
      collection: cleanTrackingString(product?.collection, 100),
      description: cleanTrackingString(product?.description, 300),
      price: cleanTrackingString(product?.finalPrice, 40),
      sizes: Array.isArray(product?.sizes) ? product.sizes.map((size) => cleanTrackingString(size, 12)).filter(Boolean).slice(0, 12) : [],
    }))
    .filter((product) => product.name);
}

async function handleSiteChat(req, res) {
  if (req.method !== "POST") return notFound(res);
  const body = await parseBody(req);
  const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
  const firstName = cleanTrackingString(profile.firstName, 80);
  const lastName = cleanTrackingString(profile.lastName, 80);
  const email = cleanEmail(profile.email);
  const phone = cleanTrackingString(profile.phone, 40);
  const message = cleanChatMessage(body.message);
  const language = siteChatLanguage(body.language);
  const languageConfig = siteChatLanguages[language];
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email)) {
    return badRequest(res, languageConfig.invalidProfile);
  }
  if (!message) return badRequest(res, languageConfig.emptyMessage);

  const catalog = cleanChatCatalog(body.catalog);
  const history = Array.isArray(body.history)
    ? body.history
        .slice(-8)
        .map((item) => ({ role: item?.role === "assistant" ? "assistant" : "user", content: cleanChatMessage(item?.content) }))
        .filter((item) => item.content)
    : [];
  const orderCode = message.match(/\bHB-[A-Z0-9-]{5,80}\b/i)?.[0];
  let orderContext = "Nessun codice ordine fornito.";
  if (orderCode) {
    const orders = await readOrders();
    const order = orders.find((item) => String(item.orderCode || "").toUpperCase() === orderCode.toUpperCase() && cleanEmail(item.customer?.email) === email);
    orderContext = order
      ? `Ordine ${order.orderCode}: stato ${order.status || "in lavorazione"}, creato il ${new Date(order.createdAt).toLocaleDateString(languageConfig.locale)}, totale ${order.total || "non disponibile"}.`
      : `Non e stato trovato un ordine ${orderCode} associato a questa email.`;
  }

  const catalogText = catalog.length
    ? catalog.map((product) => `- ${product.name} | ${product.category} | ${product.collection} | ${product.price} | taglie: ${product.sizes.join(", ") || "da verificare"} | ${product.description}`).join("\n")
    : "Catalogo momentaneamente non disponibile.";

  if (!openaiApiKey) {
    return json(res, 503, { ok: false, message: languageConfig.unavailable, language });
  }

  try {
    const data = await callOpenAiResponse({
      model: openaiProductModel,
      input: [
        {
          role: "system",
          content: [
            "Sei Aurora, assistente virtuale di Haller Boutique. Dichiara in modo naturale che sei l'assistente virtuale se ti viene chiesto chi sei; non fingere mai di essere una persona.",
            `Rispondi esclusivamente in ${languageConfig.name}, anche se il catalogo o il contesto ordine sono scritti in italiano. Mantieni un tono caldo, brillante e leggermente spiritoso, senza errori volontari. Risposte molto concise e concrete: massimo 2 frasi brevi, salvo richiesta esplicita di dettagli.`,
            "Usa esclusivamente le informazioni del catalogo e dell'ordine qui sotto. Non inventare disponibilita, spedizioni, promesse o sconti. Per le taglie dai indicazioni generali e invita a contattare WhatsApp quando serve conferma.",
            `Cliente: ${firstName} ${lastName}; email: ${email}; telefono facoltativo: ${phone || "non fornito"}.`,
            `Contesto ordine: ${orderContext}`,
            `Catalogo Haller Boutique:\n${catalogText}`,
          ].join("\n\n"),
        },
        ...history.map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: message },
      ],
      max_output_tokens: 350,
    });
    const reply = cleanChatMessage(responseOutputText(data)) || languageConfig.fallback;
    json(res, 200, { ok: true, reply, language });
  } catch (error) {
    json(res, 502, { ok: false, message: languageConfig.unavailable, language });
  }
}

async function handleAdminProducts(req, res) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: "Accesso admin richiesto." });

  if (req.method === "GET") {
    const [defaults, overrides] = await Promise.all([readDefaultProducts(), readProductOverrides()]);
    return json(res, 200, {
      ok: true,
      products: [
        ...overrides.custom.map(mergeCustomProduct),
        ...defaults.map((product) => mergeProduct(product, overrides.items)),
      ],
    });
  }

  if (req.method === "POST") {
    const body = await parseBody(req);
    return enqueueProductMutation(async () => {
      const [defaults, overrides] = await Promise.all([readDefaultProducts(), readProductOverrides()]);
      const id = cleanTrackingString(body.id, 120);
      const defaultProduct = defaults.find((product) => product.id === id);
      const customIndex = overrides.custom.findIndex((product) => product.id === id);

      if (defaultProduct) {
        overrides.items[id] = cleanProductPatch(body);
        await writeProductOverrides(overrides);
        return json(res, 200, { ok: true, product: mergeProduct(defaultProduct, overrides.items) });
      }

      if (customIndex !== -1) {
        const current = overrides.custom[customIndex];
        overrides.custom[customIndex] = cleanCustomProduct({
          ...current,
          ...body,
          id: current.id,
          createdAt: current.createdAt,
        });
        await writeProductOverrides(overrides);
        return json(res, 200, { ok: true, product: mergeCustomProduct(overrides.custom[customIndex]) });
      }

      const patch = cleanProductPatch(body);
      const product = cleanCustomProduct({
        ...patch,
        id: makeUniqueCustomProductId(patch.name, overrides),
      });
      overrides.custom.unshift(product);
      await writeProductOverrides(overrides);
      return json(res, 201, { ok: true, product: mergeCustomProduct(product) });
    });
  }

  if (req.method === "DELETE") {
    const body = await parseBody(req);
    return enqueueProductMutation(async () => {
      const [defaults, overrides] = await Promise.all([readDefaultProducts(), readProductOverrides()]);
      const id = cleanTrackingString(body.id, 120);
      if (defaults.some((product) => product.id === id)) {
        delete overrides.items[id];
      } else {
        overrides.custom = overrides.custom.filter((product) => product.id !== id);
      }
      await writeProductOverrides(overrides);
      return json(res, 200, { ok: true });
    });
  }

  return notFound(res);
}

async function handleAdminProductImages(req, res) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: "Accesso admin richiesto." });
  if (req.method !== "POST") return notFound(res);

  const contentType = String(req.headers["content-type"] || "");
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) return badRequest(res, "Upload non valido.");

  let parts;
  try {
    parts = parseMultipartBuffer(await readRequestBuffer(req, 80 * 1024 * 1024), boundary);
  } catch (error) {
    return badRequest(res, error.message || "Upload non valido.");
  }

  const productId = cleanTrackingString(parts.find((part) => part.name === "productId")?.data.toString("utf8"), 120);
  const [defaults, overrides] = await Promise.all([readDefaultProducts(), readProductOverrides()]);
  const base = defaults.find((product) => product.id === productId);
  const customIndex = overrides.custom.findIndex((product) => product.id === productId);
  if (!base && customIndex === -1) return badRequest(res, "Prodotto non valido.");

  const imageParts = parts.filter((entry) => entry.name === "images" && entry.filename).slice(0, 10);
  const originalParts = parts.filter((entry) => entry.name === "originalImage" && entry.filename).slice(0, 10);
  if (originalParts.some((part) => {
    const extension = imageExtension(part.filename, part.contentType);
    return !extension || extension === ".svg" || part.data.length === 0;
  })) return badRequest(res, "Foto originale non valida.");
  const requiredBytes = [...imageParts, ...originalParts].reduce((total, part) => total + part.data.length, 0);
  if (!productImageStorage) await ensureProductUploadCapacity(requiredBytes);
  const uploadedImages = await mapWithConcurrency(imageParts, 2, async (part, inputIndex) => {
    const ext = imageExtension(part.filename, part.contentType);
    if (!ext || ext === ".svg" || part.data.length === 0) return null;
    const name = `${slugifyProduct(productId)}-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
    const url = await storeProductImage(name, part.data, part.contentType);
    return { inputIndex, url, renditions: [] };
  });
  const validUploadedImages = uploadedImages.filter(Boolean);
  const saved = validUploadedImages.map((entry) => entry.url);
  const savedInputIndexes = validUploadedImages.map((entry) => entry.inputIndex);
  const uploadedImageRenditions = Object.fromEntries(
    validUploadedImages
      .filter((entry) => entry.renditions.length)
      .map((entry) => [entry.url, entry.renditions])
  );

  let originalImageIndexes = [];
  try {
    const parsed = JSON.parse(fieldValue(parts, "originalImageIndexes", 120) || "[]");
    if (Array.isArray(parsed)) originalImageIndexes = parsed.map(Number);
  } catch {
    originalImageIndexes = [];
  }
  const uploadedOriginals = await Promise.all(originalParts.map(async (originalPart, partIndex) => {
    const originalExt = imageExtension(originalPart.filename, originalPart.contentType);
    const originalName = `${slugifyProduct(productId)}-original-${Date.now()}-${randomBytes(4).toString("hex")}${originalExt}`;
    const originalUrl = await storeProductImage(originalName, originalPart.data, originalPart.contentType);
    const targetIndex = Number.isInteger(originalImageIndexes[partIndex]) ? originalImageIndexes[partIndex] : partIndex;
    return { targetIndex, url: originalUrl, data: originalPart.data };
  }));
  const originalSavedByIndex = new Map(
    uploadedOriginals
      .filter((entry) => entry.targetIndex >= 0 && entry.targetIndex < imageParts.length)
      .map((entry) => [entry.targetIndex, entry.url])
  );
  if (saved.length === 0) return badRequest(res, "Nessuna immagine valida caricata.");

  const makePrimary = fieldValue(parts, "makePrimary", 8) === "yes";
  let imageVariants = [];
  try {
    const parsed = JSON.parse(fieldValue(parts, "imageVariants", 180) || "[]");
    if (Array.isArray(parsed)) imageVariants = parsed.map((variant) => variant === "cropped" ? "cropped" : "original");
  } catch {
    imageVariants = [];
  }
  const legacyImageVariant = fieldValue(parts, "imageVariant", 12) === "cropped" ? "cropped" : "original";
  const imageVariant = imageVariants[savedInputIndexes[0]] || legacyImageVariant;
  const sourceSaved = saved.map((image, savedIndex) => originalSavedByIndex.get(savedInputIndexes[savedIndex]) || image);
  const zoomSaved = validUploadedImages.map((entry) => entry.url);
  const mergeUploadedImages = (current, incoming) => {
    const existing = cleanProductImages(current).filter((image) => !incoming.includes(image));
    return (makePrimary ? [...incoming, ...existing] : [...existing, ...incoming]).slice(0, maximumStoredProductImages);
  };
  const mergeZoomImages = (currentImages, currentZoomImages) => {
    const current = cleanProductImages(currentImages);
    const zoom = cleanProductImages(currentZoomImages);
    const aligned = current.map((image, index) => zoom[index] || image);
    return (makePrimary ? [...zoomSaved, ...aligned] : [...aligned, ...zoomSaved]).slice(0, maximumStoredProductImages);
  };

  let product;
  if (base) {
    const existing = overrides.items[productId] || {};
    const images = mergeUploadedImages(existing.images, saved);
    overrides.items[productId] = {
      ...base,
      ...existing,
      id: undefined,
      baseName: undefined,
      images,
      originalImages: mergeUploadedImages(existing.originalImages, sourceSaved),
      zoomImages: mergeZoomImages(existing.images, existing.zoomImages),
      imageRenditions: cleanProductImageRenditions({
        ...(existing.imageRenditions || {}),
        ...uploadedImageRenditions,
      }, images),
      imageVariant: makePrimary ? imageVariant : existing.imageVariant || "original",
      updatedAt: new Date().toISOString(),
    };
    delete overrides.items[productId].id;
    delete overrides.items[productId].baseName;
    product = mergeProduct(base, overrides.items);
  } else {
    const existing = overrides.custom[customIndex];
    const images = mergeUploadedImages(existing.images, saved);
    overrides.custom[customIndex] = cleanCustomProduct({
      ...existing,
      images,
      originalImages: mergeUploadedImages(existing.originalImages, sourceSaved),
      zoomImages: mergeZoomImages(existing.images, existing.zoomImages),
      imageRenditions: {
        ...(existing.imageRenditions || {}),
        ...uploadedImageRenditions,
      },
      imageVariant: makePrimary ? imageVariant : existing.imageVariant || "original",
    });
    product = mergeCustomProduct(overrides.custom[customIndex]);
  }
  await writeProductOverrides(overrides);
  scheduleProductImageOptimization(productId);

  json(res, 200, {
    ok: true,
    images: saved,
    originalImages: sourceSaved,
    zoomImages: zoomSaved,
    imageRenditions: uploadedImageRenditions,
    optimization: "queued",
    product,
  });
}

async function handleAdminAiProduct(req, res, { streamProgress = false } = {}) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: "Accesso admin richiesto." });
  if (req.method !== "POST") return notFound(res);
  if (!openaiApiKey) {
    return json(res, 503, {
      ok: false,
      message: "Chiave AI non configurata. Imposta OPENAI_API_KEY su Fly e riprova.",
    });
  }

  const contentType = String(req.headers["content-type"] || "");
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) return badRequest(res, "Upload non valido.");

  let parts;
  try {
    parts = parseMultipartBuffer(await readRequestBuffer(req, 35 * 1024 * 1024), boundary);
  } catch (error) {
    return badRequest(res, error.message || "Upload non valido.");
  }

  const image = parts.find((part) => part.name === "image" && part.filename);
  if (!image || image.data.length === 0) return badRequest(res, "Carica una immagine prodotto.");
  const ext = imageExtension(image.filename, image.contentType);
  if (!ext || ext === ".svg") return badRequest(res, "Formato immagine non supportato per AI. Usa JPG, PNG o WebP.");
  const sourceImage = parts.find((part) => part.name === "sourceImage" && part.filename) || image;
  const sourceExt = imageExtension(sourceImage.filename, sourceImage.contentType);
  if (!sourceExt || sourceExt === ".svg" || sourceImage.data.length === 0) {
    return badRequest(res, "Foto originale non valida. Usa JPG, PNG o WebP.");
  }
  const imageVariant = fieldValue(parts, "imageVariant", 12) === "cropped" ? "cropped" : "original";

  const progress = streamProgress ? createProgressStream(res) : null;
  progress?.update(24, "Foto ricevuta");
  const name = `ai-product-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
  const imageUrl = await storeProductImage(name, image.data, image.contentType);
  const imageRenditions = await createProductImageRenditions(name, image.data);
  let originalImageUrl = imageUrl;
  if (sourceImage !== image) {
    const originalName = `ai-product-original-${Date.now()}-${randomBytes(4).toString("hex")}${sourceExt}`;
    originalImageUrl = await storeProductImage(originalName, sourceImage.data, sourceImage.contentType);
  }
  let zoomImageUrl = imageUrl;
  if (imageVariant === "cropped" && sourceImage !== image) {
    const generated = await createAndStoreProductZoomImage("ai-product", sourceImage.data, image.data);
    zoomImageUrl = generated.url;
  }
  const sourceMime = sourceImage.contentType || (sourceExt === ".png" ? "image/png" : sourceExt === ".webp" ? "image/webp" : "image/jpeg");
  const dataUrl = `data:${sourceMime};base64,${sourceImage.data.toString("base64")}`;
  progress?.update(42, "Foto preparata");

  try {
    progress?.update(58, "Ricerca e descrizione AI in corso");
    const rawSuggestion = await analyzeProductImageWithAi(dataUrl);
    progress?.update(90, "Dati prodotto ricevuti");
    const suggestion = {
      ...cleanAiSuggestion(rawSuggestion, imageUrl),
      originalImages: [originalImageUrl],
      zoomImages: [zoomImageUrl],
      imageRenditions: imageRenditions.length ? { [imageUrl]: imageRenditions } : {},
      imageVariant,
    };
    const result = { ok: true, image: imageUrl, originalImage: originalImageUrl, zoomImage: zoomImageUrl, suggestion };
    if (progress) return progress.done(result);
    json(res, 200, result);
  } catch (error) {
    const message = `AI non disponibile: ${cleanTrackingString(error.message, 220)}`;
    if (progress) return progress.fail(message);
    json(res, 502, { ok: false, message, image: imageUrl });
  }
}

async function handleTryOn(req, res, { streamProgress = false, asyncJob = false } = {}) {
  if (req.method !== "POST") return notFound(res);

  const requestId = asyncJob ? cleanTryOnRequestId(req.headers["x-haller-request-id"]) : "";
  if (requestId) {
    pruneTryOnJobs();
    const existingJob = tryOnJobs.get(tryOnRequestJobs.get(requestId)?.jobId);
    if (existingJob) return json(res, 202, publicTryOnJob(existingJob), { "Retry-After": "2" });
  }

  const contentType = String(req.headers["content-type"] || "");
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) return badRequest(res, "Upload non valido.");

  let parts;
  try {
    parts = parseMultipartBuffer(await readRequestBuffer(req, 60 * 1024 * 1024), boundary);
  } catch (error) {
    return badRequest(res, error.message || "Upload non valido.");
  }

  const language = siteChatLanguage(fieldValue(parts, "language", 8));
  const copy = tryOnLanguages[language];
  if (!openaiApiKey) return json(res, 503, { ok: false, message: copy.notConfigured, language });

  const image = parts.find((part) => part.name === "userImage" && part.filename);
  if (!image || image.data.length === 0) return badRequest(res, copy.upload);
  const ext = imageExtension(image.filename, image.contentType);
  if (!ext || ext === ".svg") return badRequest(res, copy.format);

  const productName = fieldValue(parts, "productName", 180);
  const category = fieldValue(parts, "category", 120);
  const productId = fieldValue(parts, "productId", 120);
  const mode = fieldValue(parts, "mode", 20) === "bundle" ? "bundle" : "single";
  let bundleItems = mode === "bundle" ? cleanTryOnBundleItems(fieldValue(parts, "bundleItems", 6000)) : [];
  if (mode === "bundle" && (bundleItems.length === 0 || bundleItems.length > 2)) {
    return badRequest(res, copy.bundleRules);
  }
  const uploadedProductImages = parts
    .filter((part) => part.name === "productImage" && part.filename)
    .map((part, index) => {
        const productExt = imageExtension(part.filename, part.contentType);
        if (!productExt || productExt === ".svg" || part.data.length === 0) return null;
        return {
          data: part.data,
          mime: imageMimeFromExtension(productExt),
          filename: `product-${index + 1}${productExt}`,
        };
      });
  if (uploadedProductImages.some((item) => !item)) {
    return badRequest(res, copy.bundleImages);
  }
  if (mode === "bundle" && uploadedProductImages.length > 0) {
    const legacyBundle = bundleItems.every((item) => item.referenceImageIndices === null);
    if (legacyBundle) {
      if (uploadedProductImages.length !== bundleItems.length) return badRequest(res, copy.bundleImages);
      bundleItems = bundleItems.map((item, index) => ({ ...item, referenceImageIndices: [index + 2] }));
    } else {
      const referenceIndices = bundleItems
        .flatMap((item) => item.referenceImageIndices || []);
      const validIndices = bundleItems.every((item) => Array.isArray(item.referenceImageIndices))
        && referenceIndices.length === uploadedProductImages.length
        && referenceIndices.every((value, index) => value === index + 2);
      if (!validIndices) return badRequest(res, copy.bundleImages);
    }
  }
  if (mode === "single" && uploadedProductImages.length > 1) {
    return badRequest(res, copy.bundleImages);
  }
  let productImages = uploadedProductImages;
  if (uploadedProductImages.length > 0) {
    try {
      productImages = await Promise.all(
        uploadedProductImages.map((productImage, index) => normalizeTryOnProductImage(productImage, index)),
      );
    } catch (error) {
      console.error("[try-on] product image normalization failed", {
        itemIds: bundleItems.map((item) => item.id),
        error: cleanTrackingString(error?.message, 220),
      });
      return badRequest(res, copy.bundleImages);
    }
  } else {
    const productIds = mode === "bundle"
      ? bundleItems.map((item) => item.id)
      : [productId];
    try {
      productImages = await loadCatalogTryOnProductImages(productIds);
      if (mode === "bundle") {
        bundleItems = bundleItems.map((item, index) => ({
          ...item,
          referenceImageIndices: [index + 2],
        }));
      }
    } catch (error) {
      console.error("[try-on] catalog product image preparation failed", {
        productIds,
        error: cleanTrackingString(error?.message, 220),
      });
      return badRequest(res, copy.bundleImages);
    }
  }
  const progress = streamProgress ? createProgressStream(res) : null;
  progress?.update(24, copy.received);
  const saveTryOn = fieldValue(parts, "saveTryOn", 10) === "yes";
  const customerImage = parts.find((part) => part.name === "customerImage" && part.filename) || image;
  let userImage;
  try {
    userImage = await normalizeTryOnCustomerImage({
      data: image.data,
      mime: imageMimeFromExtension(ext),
      filename: image.filename || `customer${ext}`,
    });
  } catch (error) {
    console.error("[try-on] customer image normalization failed", {
      error: cleanTrackingString(error?.message, 220),
    });
    return badRequest(res, copy.rejected);
  }

  if (asyncJob) {
    const job = startTryOnJob({
      userImage,
      productImages,
      productName,
      category,
      bundleItems,
      mode,
      saveTryOn,
      customerImage,
      productId,
      copy,
    });
    if (!job) return json(res, 429, { ok: false, message: copy.busy });
    if (requestId) tryOnRequestJobs.set(requestId, { jobId: job.id, createdAt: Date.now() });
    return json(res, 202, publicTryOnJob(job), { "Retry-After": "2" });
  }

  try {
    progress?.update(46, mode === "bundle" ? copy.bundlePrepared : copy.prepared);
    progress?.update(60, mode === "bundle" ? copy.bundleGenerating : copy.generating);
    const generated = await generateTryOnImage({ userImage, productImages, productName, category, bundleItems });
    progress?.update(92, mode === "bundle" ? copy.bundlePreview : copy.preview);
    const archived = saveTryOn && customerImage ? await archiveTryOn({ customerImage, generated, productId, productName, category }) : null;
    const result = { ok: true, image: generated, saved: Boolean(archived), mode };
    if (progress) return progress.done(result);
    json(res, 200, result);
  } catch (error) {
    const message = tryOnFailureMessage(error, copy);
    console.error("[try-on] generation failed", {
      mode,
      itemCount: bundleItems.length,
      itemIds: bundleItems.map((item) => item.id),
      status: Number(error?.status || 0),
      error: cleanTrackingString(error?.message, 220),
    });
    if (progress) return progress.fail(message);
    json(res, 502, { ok: false, message });
  }
}

async function handleAdminTryOnArchive(req, res) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: "Accesso admin richiesto." });
  if (req.method !== "GET") return notFound(res);
  const items = await pruneTryOnArchive();
  return json(res, 200, {
    ok: true,
    items: items.slice(0, 50).map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      sourceUrl: `/api/admin/try-on/${item.id}/source`,
      previewUrl: item.previewFile ? `/api/admin/try-on/${item.id}/preview` : "",
    })),
  });
}

async function handleAdminTryOnImage(req, res, url) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: "Accesso admin richiesto." });
  if (req.method !== "GET") return notFound(res);
  const match = url.pathname.match(/^\/api\/admin\/try-on\/(tryon_[a-z0-9_]+)\/(source|preview)$/i);
  if (!match) return notFound(res);
  const items = await pruneTryOnArchive();
  const item = items.find((entry) => entry.id === match[1]);
  const fileName = match[2] === "source" ? item?.sourceFile : item?.previewFile;
  if (!fileName) return notFound(res);

  const filePath = path.join(tryOnDir, path.basename(fileName));
  try {
    const image = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Content-Length": image.length,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(image);
  } catch {
    return notFound(res);
  }
}

function cleanTrackingString(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function cleanSessionId(value) {
  const id = cleanTrackingString(value, 80);
  return /^[a-zA-Z0-9_-]{8,80}$/.test(id) ? id : `srv_${randomBytes(12).toString("hex")}`;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanPreciseLocation(location) {
  if (!location || typeof location !== "object") return null;
  const latitude = finiteNumber(location.latitude);
  const longitude = finiteNumber(location.longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const accuracy = finiteNumber(location.accuracy);
  const altitude = finiteNumber(location.altitude);
  const altitudeAccuracy = finiteNumber(location.altitudeAccuracy);
  const heading = finiteNumber(location.heading);
  const speed = finiteNumber(location.speed);

  return {
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    accuracy: accuracy === null ? null : Math.max(0, Math.min(100000, Math.round(accuracy))),
    altitude: altitude === null ? null : Number(altitude.toFixed(2)),
    altitudeAccuracy: altitudeAccuracy === null ? null : Math.max(0, Math.min(100000, Math.round(altitudeAccuracy))),
    heading: heading === null ? null : Math.max(0, Math.min(360, Math.round(heading))),
    speed: speed === null ? null : Math.max(0, Math.min(1000, Number(speed.toFixed(2)))),
    capturedAt: cleanTrackingString(location.capturedAt, 40) || new Date().toISOString(),
  };
}

async function handleConsent(req, res) {
  const body = await parseBody(req);
  const accepted = Boolean(body.analytics || body.replay || body.location);
  if (!accepted) {
    return json(res, 200, { ok: true, visitorId: "" }, { "Set-Cookie": clearCookie("hb_anon") });
  }

  const existing = cleanAnonId(parseCookies(req).hb_anon);
  const visitorId = existing || `anon_${randomBytes(12).toString("hex")}`;
  json(
    res,
    200,
    {
      ok: true,
      visitorId,
      mode: "first-party-server-cookie",
    },
    { "Set-Cookie": anonCookie(visitorId) }
  );
}

function cleanReplayEvents(events) {
  if (!Array.isArray(events)) return [];
  const allowedTypes = new Set(["page", "move", "click", "scroll", "resize", "input", "checkout", "order"]);
  return events
    .slice(0, 80)
    .map((event) => {
      const type = cleanTrackingString(event.type, 24);
      if (!allowedTypes.has(type)) return null;
      return {
        t: Math.max(0, Math.min(60 * 60 * 1000, Number(event.t || 0))),
        type,
        x: Math.max(0, Math.min(10000, Number(event.x || 0))),
        y: Math.max(0, Math.min(10000, Number(event.y || 0))),
        scrollY: Math.max(0, Math.min(200000, Number(event.scrollY || 0))),
        depth: Math.max(0, Math.min(100, Number(event.depth || 0))),
        w: Math.max(0, Math.min(10000, Number(event.w || 0))),
        h: Math.max(0, Math.min(10000, Number(event.h || 0))),
        target: cleanTrackingString(event.target, 120),
        text: cleanTrackingString(event.text, 120),
        field: cleanTrackingString(event.field, 80),
      };
    })
    .filter(Boolean);
}

async function handleTrack(req, res) {
  const body = await parseBody(req);
  const now = new Date().toISOString();
  const type = cleanTrackingString(body.type, 40) || "event";
  const sessionId = cleanSessionId(body.sessionId);
  const cookieVisitorId = cleanAnonId(parseCookies(req).hb_anon);
  const visitorId = cookieVisitorId || cleanTrackingString(body.visitorId, 80) || sessionId;
  const pathName = cleanTrackingString(body.path, 220) || "/";
  const ip = clientIp(req);
  const ipAddress = cleanIp(ip);
  const clientInfo = cleanClientDeviceInfo(body.deviceInfo);
  const ua = parseUserAgent(req.headers["user-agent"] || "", clientInfo);
  await mutateAnalytics(async (analytics) => {
  const existing = analytics.sessions[sessionId] || {};
  const ipLocation =
    existing.ipLocation && (existing.ipLocation.country || existing.ipLocation.city)
      ? existing.ipLocation
      : await lookupIpLocation(ip);
  const preciseLocation = cleanPreciseLocation(body.preciseLocation);
  const preciseLocationStatus = cleanTrackingString(body.preciseLocationStatus, 40);
  const replayEvents = body.replayConsent === true ? cleanReplayEvents(body.replay) : [];

  const session = {
    ...existing,
    id: sessionId,
    visitorId,
    startedAt: existing.startedAt || now,
    lastSeenAt: now,
    path: pathName,
    referrer: existing.referrer || cleanTrackingString(body.referrer, 240),
    landingPage: existing.landingPage || pathName,
    ipAddress: ipAddress || existing.ipAddress,
    ipMasked: existing.ipMasked || maskIp(ip),
    ipHash: existing.ipHash || hashIp(ip),
    ipLocation,
    preciseLocation: preciseLocation || existing.preciseLocation,
    preciseLocationStatus: preciseLocation ? "granted" : preciseLocationStatus || existing.preciseLocationStatus,
    preciseLocationError: cleanTrackingString(body.locationError, 160) || existing.preciseLocationError,
    preciseLocationAt: preciseLocation ? now : existing.preciseLocationAt,
    device: ua.device,
    deviceModel: ua.deviceModel || existing.deviceModel,
    browser: ua.browser,
    os: ua.os,
    osVersion: ua.osVersion || existing.osVersion,
    screen: clientInfo.screen || existing.screen,
    viewport: clientInfo.viewport || existing.viewport,
    language: clientInfo.language || existing.language,
    timezone: clientInfo.timezone || existing.timezone,
    platform: clientInfo.platform || existing.platform,
    platformVersion: clientInfo.platformVersion || existing.platformVersion,
    architecture: clientInfo.architecture || existing.architecture,
    bitness: clientInfo.bitness || existing.bitness,
    touchPoints: clientInfo.touchPoints || existing.touchPoints,
    pageviews: (existing.pageviews || 0) + (type === "pageview" ? 1 : 0),
    eventsCount: (existing.eventsCount || 0) + 1,
    durationMs: Math.max(Number(existing.durationMs || 0), Number(body.durationMs || 0)),
    maxScroll: Math.max(Number(existing.maxScroll || 0), Number(body.scrollDepth || 0)),
    checkoutStarted: Boolean(existing.checkoutStarted || type === "checkout_start"),
    checkoutAt: existing.checkoutAt || (type === "checkout_start" ? now : undefined),
    orderPlaced: Boolean(existing.orderPlaced || type === "order_confirmed"),
    orderAt: existing.orderAt || (type === "order_confirmed" ? now : undefined),
    lastEvent: type,
    replay: Array.isArray(existing.replay)
      ? existing.replay.concat(replayEvents.map((event) => ({ ...event, at: now, path: pathName }))).slice(-replayMaxEvents)
      : replayEvents.map((event) => ({ ...event, at: now, path: pathName })).slice(-replayMaxEvents),
    replayLastAt: replayEvents.length > 0 ? now : existing.replayLastAt,
  };

  analytics.sessions[sessionId] = session;
  analytics.events.push({
    id: `evt_${randomBytes(8).toString("hex")}`,
    at: now,
    type,
    sessionId,
    visitorId,
    path: pathName,
    title: cleanTrackingString(body.title, 120),
    product: cleanTrackingString(body.product, 160),
    method: cleanTrackingString(body.method, 80),
    scrollDepth: Number(body.scrollDepth || 0),
    durationMs: Number(body.durationMs || 0),
    preciseLocation: preciseLocation || undefined,
    preciseLocationStatus: preciseLocationStatus || undefined,
    replayCount: replayEvents.length,
  });

  });
  json(res, 200, { ok: true, sessionId });
}

function cleanProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.slice(0, 20).map((product) => {
    const price = cleanTrackingString(product.price, 40);
    const quantity = Math.max(1, Math.min(99, Number.parseInt(product.quantity || 1, 10) || 1));
    return {
      id: cleanTrackingString(product.id, 120),
      name: cleanTrackingString(product.name, 180) || "Prodotto",
      price,
      size: cleanTrackingString(product.size || product.variant, 40),
      quantity,
      value: parseEuro(price) * quantity,
    };
  });
}

async function reduceProductInventory(products) {
  const overrides = await readProductOverrides();
  let changed = false;

  for (const ordered of products) {
    if (!ordered.id) continue;
    const customIndex = overrides.custom.findIndex((product) => product.id === ordered.id);
    const product = customIndex === -1 ? overrides.items[ordered.id] : overrides.custom[customIndex];
    if (!product || productInventoryTotal(product) === null) continue;
    if (!adjustProductInventory(product, ordered, -1)) {
      return { ok: false, product: ordered };
    }
    changed = true;
  }

  if (changed) await writeProductOverrides(overrides);
  return { ok: true };
}

async function restoreProductInventory(products) {
  const overrides = await readProductOverrides();
  let changed = false;

  for (const ordered of Array.isArray(products) ? products : []) {
    if (!ordered.id) continue;
    const customIndex = overrides.custom.findIndex((product) => product.id === ordered.id);
    const product = customIndex === -1 ? overrides.items[ordered.id] : overrides.custom[customIndex];
    if (adjustProductInventory(product, ordered, 1)) changed = true;
  }

  if (changed) await writeProductOverrides(overrides);
}

const mobilePushRetryDelaysMs = [
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
];

function mobilePushRetryAt(attempts) {
  const index = Math.min(Math.max(0, attempts - 1), mobilePushRetryDelaysMs.length - 1);
  return new Date(Date.now() + mobilePushRetryDelaysMs[index]).toISOString();
}

async function claimMobilePushNotification() {
  return enqueueOrderMutation(async () => {
    const orders = await readOrders();
    const now = new Date();
    const order = orders.find((entry) => {
      const notification = entry.mobilePushNotification;
      if (!notification || notification.status === "sent") return false;
      if (notification.status === "sending") {
        return !notification.leaseUntil || new Date(notification.leaseUntil).getTime() <= now.getTime();
      }
      return !notification.nextAttemptAt || new Date(notification.nextAttemptAt).getTime() <= now.getTime();
    });
    if (!order) return null;

    const attempts = Number(order.mobilePushNotification?.attempts || 0) + 1;
    order.mobilePushNotification = {
      ...order.mobilePushNotification,
      status: "sending",
      attempts,
      lastAttemptAt: now.toISOString(),
      leaseUntil: new Date(now.getTime() + 2 * 60 * 1000).toISOString(),
    };
    await writeOrders(orders);
    return structuredClone(order);
  });
}

async function finishMobilePushNotification(orderId, result, error) {
  await enqueueOrderMutation(async () => {
    const orders = await readOrders();
    const order = orders.find((entry) => entry.id === orderId);
    if (!order?.mobilePushNotification || order.mobilePushNotification.status === "sent") return;
    const attempts = Number(order.mobilePushNotification.attempts || 1);
    if (error || !result?.sent) {
      order.mobilePushNotification = {
        ...order.mobilePushNotification,
        status: "failed",
        nextAttemptAt: mobilePushRetryAt(attempts),
        lastError: cleanTrackingString(error?.message || "Notifica non consegnata.", 300),
      };
    } else {
      order.mobilePushNotification = {
        ...order.mobilePushNotification,
        status: "sent",
        sentAt: new Date().toISOString(),
        deliveredDevices: Number(result.sent || 0),
      };
      delete order.mobilePushNotification.nextAttemptAt;
      delete order.mobilePushNotification.lastError;
    }
    delete order.mobilePushNotification.leaseUntil;
    await writeOrders(orders);
  });
}

async function removeInvalidPushTokens(tokens) {
  if (!Array.isArray(tokens) || !tokens.length) return;
  const invalid = new Set(tokens);
  await enqueuePushSubscriptionMutation(async () => {
    const subscriptions = await readPushSubscriptions();
    await writePushSubscriptions(subscriptions.filter((entry) => !invalid.has(entry.token)));
  });
}

async function processMobilePushNotifications() {
  if (mobilePushQueueRunning) return;
  const initialSubscriptions = await readPushSubscriptions();
  if (!initialSubscriptions.length) return;
  mobilePushQueueRunning = true;

  try {
    for (let processed = 0; processed < 10; processed += 1) {
      const order = await claimMobilePushNotification();
      if (!order) break;
      try {
        const subscriptions = await readPushSubscriptions();
        if (!subscriptions.length) {
          await finishMobilePushNotification(order.id, null, new Error("Nessun dispositivo registrato."));
          break;
        }
        const result = await sendExpoPushNotifications({ subscriptions, order });
        await removeInvalidPushTokens(result.invalidTokens);
        await finishMobilePushNotification(order.id, result);
      } catch (error) {
        console.error(`[push] Order notification failed for ${order.orderCode}: ${error.message}`);
        await finishMobilePushNotification(order.id, null, error);
      }
    }
  } finally {
    mobilePushQueueRunning = false;
  }
}

async function handleCreateOrder(req, res) {
  const body = await parseBody(req);
  const validation = validateCheckoutOrder(body);
  if (!validation.ok) return badRequest(res, validation.message);
  const now = new Date().toISOString();
  const sessionId = cleanSessionId(body.sessionId);
  const products = cleanProducts(body.products || body.items);
  const productsTotal = products.reduce((sum, product) => sum + product.value, 0);
  const totalValue = productsTotal || parseEuro(body.total);
  const clientInfo = cleanClientDeviceInfo(body.deviceInfo);
  const ua = parseUserAgent(req.headers["user-agent"] || "", clientInfo);
  const ip = clientIp(req);
  const ipAddress = cleanIp(ip);
  const ipLocation = await lookupIpLocation(ip);
  const preciseLocation = cleanPreciseLocation(body.preciseLocation);
  const order = {
    id: `ord_${randomBytes(10).toString("hex")}`,
    orderCode: cleanTrackingString(body.orderCode, 80) || `HB-${Date.now()}`,
    createdAt: now,
    status: "Nuovo",
    statusUpdatedAt: now,
    statusHistory: [{ status: ORDER_STATUS.NEW, at: now }],
    sessionId,
    visitorId: cleanTrackingString(body.visitorId, 80),
    customer: {
      name: cleanTrackingString(body.customer?.name, 120),
      email: cleanEmail(body.customer?.email),
      phone: cleanTrackingString(body.customer?.phone, 60),
      city: cleanTrackingString(body.customer?.city, 80),
      postalCode: cleanTrackingString(body.customer?.postalCode, 20),
      province: cleanTrackingString(body.customer?.province, 80),
      country: cleanTrackingString(body.customer?.country, 80),
      countryCode: cleanTrackingString(body.customer?.countryCode, 8).toUpperCase(),
      address: cleanTrackingString(body.customer?.address, 180),
      addressId: cleanTrackingString(body.customer?.addressId, 80),
      addressVerified: body.customer?.addressVerified === true,
    },
    paymentMethod: cleanTrackingString(body.paymentMethod, 80) || "Contrassegno",
    txHash: cleanTrackingString(body.txHash, 180),
    discountCode: cleanTrackingString(body.discountCode, 60),
    products,
    totalValue: formatEuroValue(totalValue),
    total: `${formatEuroValue(totalValue).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`,
    ipAddress,
    ipMasked: maskIp(ip),
    ipHash: hashIp(ip),
    ipLocation,
    preciseLocation,
    userAgent: ua,
    deviceInfo: clientInfo,
    mobilePushNotification: {
      status: "pending",
      attempts: 0,
      nextAttemptAt: now,
    },
  };

  const inventoryReservation = await enqueueProductMutation(() => reduceProductInventory(products));
  if (!inventoryReservation.ok) {
    const unavailable = inventoryReservation.product;
    const size = unavailable?.size ? `, taglia ${unavailable.size}` : "";
    return json(res, 409, {
      ok: false,
      message: `${unavailable?.name || "Il prodotto"}${size} non è più disponibile nella quantità richiesta.`,
    });
  }

  try {
    await enqueueOrderMutation(async () => {
      const orders = await readOrders();
      orders.push(order);
      await writeOrders(orders.slice(-2000));
    });
  } catch (error) {
    await enqueueProductMutation(() => restoreProductInventory(products));
    throw error;
  }

  await mutateAnalytics(async (analytics) => {
    const session = analytics.sessions[sessionId];
    if (session) {
      session.orderPlaced = true;
      session.orderAt = now;
      session.lastSeenAt = now;
    }
    analytics.events.push({
      id: `evt_${randomBytes(8).toString("hex")}`,
      at: now,
      type: "order_confirmed",
      sessionId,
      visitorId: order.visitorId,
      path: "/checkout.html",
      product: products.map((product) => product.name).join("; ").slice(0, 180),
      method: order.paymentMethod,
    });
  });

  json(res, 201, { ok: true, order: { id: order.id, orderCode: order.orderCode, total: order.total } });
  setTimeout(() => processMobilePushNotifications().catch((error) => {
    console.error(`[push] Notification queue failed: ${error.message}`);
  }), 0);
}

function buildMetrics(users, analytics, orders) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const sessions = Object.values(analytics.sessions);
  const events = analytics.events;
  const recentEvents = events.filter((event) => new Date(event.at).getTime() >= dayAgo);
  const uniqueVisitors = new Set(sessions.map((session) => session.visitorId)).size;
  const visitors24h = new Set(
    sessions
      .filter((session) => new Date(session.lastSeenAt).getTime() >= dayAgo)
      .map((session) => session.visitorId)
  ).size;
  const liveSessions = sessions
    .filter((session) => now - new Date(session.lastSeenAt).getTime() <= liveWindowMs)
    .sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
  const pageviews = events.filter((event) => event.type === "pageview").length;
  const pageviews24h = recentEvents.filter((event) => event.type === "pageview").length;
  const checkoutStarts = sessions.filter((session) => session.checkoutStarted).length;
  const abandonedCheckouts = sessions.filter((session) => {
    const lastSeen = new Date(session.lastSeenAt).getTime();
    return session.checkoutStarted && !session.orderPlaced && now - lastSeen > 10 * 60 * 1000;
  }).length;
  const revenue = orders.reduce((sum, order) => sum + Number(order.totalValue || 0), 0);
  const averageDurationMs = sessions.length
    ? sessions.reduce((sum, session) => sum + Number(session.durationMs || 0), 0) / sessions.length
    : 0;
  const sessionSummary = (session) => ({
    id: session.id,
    path: session.path,
    landingPage: session.landingPage,
    referrer: session.referrer,
    startedAt: session.startedAt,
    lastSeenAt: session.lastSeenAt,
    replayLastAt: session.replayLastAt,
    durationMs: session.durationMs,
    isLive: now - new Date(session.lastSeenAt).getTime() <= liveWindowMs,
    pageviews: Number(session.pageviews || 0),
    eventsCount: Number(session.eventsCount || 0),
    maxScroll: Number(session.maxScroll || 0),
    lastEvent: session.lastEvent || "",
    replayEvents: Array.isArray(session.replay) ? session.replay.length : 0,
    device: session.device,
    deviceModel: session.deviceModel,
    browser: session.browser,
    os: session.os,
    osVersion: session.osVersion,
    screen: session.screen,
    viewport: session.viewport,
    language: session.language,
    timezone: session.timezone,
    ipAddress: session.ipAddress || "",
    ipMasked: session.ipMasked,
    ipLocation: session.ipLocation || emptyIpLocation(),
    preciseLocation: session.preciseLocation || null,
    preciseLocationStatus: session.preciseLocationStatus || "",
    preciseLocationError: session.preciseLocationError || "",
    preciseLocationAt: session.preciseLocationAt || "",
    checkoutStarted: Boolean(session.checkoutStarted),
    orderPlaced: Boolean(session.orderPlaced),
  });
  const visitHistory = [...sessions].sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));

  const productMap = {};
  orders.forEach((order) => {
    productRowsFromOrder(order).forEach((product) => {
      const name = product.name || "Prodotto";
      productMap[name] = productMap[name] || { name, quantity: 0, revenue: 0 };
      productMap[name].quantity += Number(product.quantity || 1);
      productMap[name].revenue += Number(product.value || parseEuro(product.price));
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      users: users.length,
      visitors: uniqueVisitors,
      visitors24h,
      liveVisitors: liveSessions.length,
      pageviews,
      pageviews24h,
      checkoutStarts,
      abandonedCheckouts,
      orders: orders.length,
      conversionRate: uniqueVisitors ? orders.length / uniqueVisitors : 0,
      revenue: formatEuroValue(revenue),
      averageOrderValue: orders.length ? formatEuroValue(revenue / orders.length) : 0,
      averageDurationMs: Math.round(averageDurationMs),
    },
    liveSessions: liveSessions.slice(0, 30).map(sessionSummary),
    visitHistory: visitHistory.slice(0, 200).map(sessionSummary),
    replaySessions: sessions
      .filter((session) => Array.isArray(session.replay) && session.replay.length > 0)
      .sort((a, b) => String(b.replayLastAt || b.lastSeenAt).localeCompare(String(a.replayLastAt || a.lastSeenAt)))
      .slice(0, 50)
      .map((session) => ({ ...sessionSummary(session), events: session.replay.length })),
    recentOrders: orders.slice(-60).reverse(),
    recentEvents: events.slice(-120).reverse(),
    topProducts: Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20)
      .map((product) => ({ ...product, revenue: formatEuroValue(product.revenue) })),
    devices: countBy(sessions, (session) => session.device),
    deviceModels: countBy(sessions, (session) => session.deviceModel || session.device),
    browsers: countBy(sessions, (session) => session.browser),
    os: countBy(sessions, (session) => session.os),
    osVersions: countBy(sessions, (session) => {
      const os = session.os || "Altro";
      return session.osVersion ? `${os} ${session.osVersion}` : os;
    }),
    referrers: countBy(sessions, (session) => {
      if (!session.referrer) return "Diretto";
      try {
        return new URL(session.referrer).hostname.replace(/^www\./, "");
      } catch {
        return "Altro";
      }
    }).slice(0, 12),
    payments: countBy(orders, (order) => order.paymentMethod || "Non definito"),
    pages: countBy(events.filter((event) => event.type === "pageview"), (event) => event.path).slice(0, 15),
  };
}

async function handleAdminMetrics(req, res) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: "Accesso admin richiesto." });
  const [users, analytics, orders] = await Promise.all([readUsers(), readAnalytics(), readOrders()]);
  json(res, 200, { ok: true, metrics: buildMetrics(users, analytics, orders) });
}

async function handleAdminReplay(req, res, url) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: "Accesso admin richiesto." });
  const sessionId = cleanTrackingString(url.searchParams.get("sessionId"), 80);
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId)) return badRequest(res, "Sessione non valida.");
  const analytics = await readAnalytics();
  const session = analytics.sessions[sessionId];
  if (!session || !Array.isArray(session.replay)) {
    return json(res, 404, { ok: false, message: "Replay non trovato." });
  }
  json(res, 200, {
    ok: true,
    replay: {
      id: session.id,
      path: session.path,
      startedAt: session.startedAt,
      lastSeenAt: session.lastSeenAt,
      durationMs: session.durationMs,
      device: session.device,
      deviceModel: session.deviceModel,
      browser: session.browser,
      os: session.os,
      osVersion: session.osVersion,
      screen: session.screen,
      viewport: session.viewport,
      ipAddress: session.ipAddress || "",
      ipMasked: session.ipMasked,
      ipLocation: session.ipLocation || emptyIpLocation(),
      preciseLocation: session.preciseLocation || null,
      preciseLocationStatus: session.preciseLocationStatus || "",
      preciseLocationError: session.preciseLocationError || "",
      preciseLocationAt: session.preciseLocationAt || "",
      events: session.replay,
    },
  });
}

function startOauth(req, res, providerKey) {
  const provider = oauthProviders[providerKey];
  if (!provider || !providerConfigured(providerKey)) {
    return redirect(res, `/account.html?oauth=${providerKey}&error=not_configured`);
  }
  const state = randomBytes(18).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = `${origin(req)}/auth/${providerKey}/callback`;
  const params = new URLSearchParams({
    client_id: process.env[provider.env[0]],
    redirect_uri: redirectUri,
    response_type: "code",
    scope: provider.scope,
    state,
  });
  if (providerKey === "google") params.set("prompt", "select_account");
  if (providerKey === "microsoft") {
    params.set("response_mode", "query");
    params.set("code_challenge", challenge);
    params.set("code_challenge_method", "S256");
  }
  const cookies = [cookie("hb_oauth_state", state, 600)];
  if (providerKey === "microsoft") cookies.push(pkceVerifierCookie(verifier));
  redirect(res, `${provider.authUrl}?${params.toString()}`, { "Set-Cookie": cookies });
}

function decodeJwtPayload(token) {
  const payload = String(token || "").split(".")[1];
  if (!payload) return {};
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function tokenProfile(providerKey, token) {
  const profile = decodeJwtPayload(token.id_token);
  const clientId = process.env[oauthProviders[providerKey].env[0]];
  const now = Math.floor(Date.now() / 1000);
  if (!profile.sub) throw new Error("id_token_missing_subject");
  if (profile.aud !== clientId) throw new Error("id_token_audience");
  if (profile.exp && profile.exp < now) throw new Error("id_token_expired");
  return profile;
}

function oauthError(res, providerKey, error, detail = "") {
  const params = new URLSearchParams({ oauth: providerKey, error });
  if (detail) params.set("detail", detail.slice(0, 80));
  return redirect(res, `/account.html?${params.toString()}`);
}

async function oauthCallback(req, res, providerKey, url) {
  const provider = oauthProviders[providerKey];
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) {
    return oauthError(
      res,
      providerKey,
      url.searchParams.get("error"),
      url.searchParams.get("error_description") || ""
    );
  }
  if (!state || parseCookies(req).hb_oauth_state !== state) {
    return oauthError(res, providerKey, "oauth_state");
  }
  const code = url.searchParams.get("code");
  if (!code) return oauthError(res, providerKey, "oauth_code");

  const redirectUri = `${origin(req)}/auth/${providerKey}/callback`;
  const cookies = parseCookies(req);
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env[provider.env[0]],
  });
  if (providerKey === "microsoft") {
    tokenBody.set("code_verifier", cookies.hb_oauth_verifier || "");
    tokenBody.set("client_secret", process.env[provider.env[1]]);
  } else {
    tokenBody.set("client_secret", process.env[provider.env[1]]);
  }
  const tokenResponse = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenResponse.ok) {
    const tokenError = await tokenResponse.text();
    let tokenDetail = "";
    try {
      const parsedError = JSON.parse(tokenError);
      tokenDetail = String(parsedError.error_description || parsedError.error_codes?.[0] || parsedError.error || "");
    } catch {
      tokenDetail = tokenError;
    }
    console.error(`OAuth token error ${providerKey}: ${tokenResponse.status} ${tokenError.slice(0, 500)}`);
    return oauthError(res, providerKey, "token", tokenDetail);
  }
  const token = await tokenResponse.json();

  let profile = {};
  try {
    profile = provider.useIdToken ? tokenProfile(providerKey, token) : {};
  } catch (error) {
    console.error(`OAuth id_token error ${providerKey}: ${error.message}`);
    return oauthError(res, providerKey, error.message);
  }

  if (!provider.useIdToken && provider.userInfoUrl) {
    const userInfo = await fetch(provider.userInfoUrl, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userInfo.ok) {
      console.error(`OAuth userinfo error ${providerKey}: ${userInfo.status}`);
      return oauthError(res, providerKey, "userinfo");
    }
    profile = await userInfo.json();
  } else if (!provider.useIdToken) {
    profile = decodeJwtPayload(token.id_token);
  }

  const email = cleanEmail(profile.email || profile.upn || profile.preferred_username || profile.unique_name);
  if (!email) return oauthError(res, providerKey, "email");

  const user = await upsertOauthUser({
    provider: providerKey,
    providerId: String(profile.sub || profile.oid || profile.id || email),
    email,
    name: profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(" "),
  });

  redirect(res, "/account.html?login=ok", {
    "Set-Cookie": [sessionCookie(user.id), clearCookie("hb_oauth_state"), clearCookie("hb_oauth_verifier")],
  });
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/internal/product-image-optimization") return handleProductImageOptimization(req, res, url);
  if (url.pathname === "/api/internal/product-zoom-image-optimization") return handleProductZoomImageOptimization(req, res, url);
  if (req.method === "POST" && url.pathname === "/api/consent") return handleConsent(req, res);
  if (req.method === "POST" && url.pathname === "/api/track") return handleTrack(req, res);
  if (req.method === "GET" && url.pathname === "/api/address-suggestions") return handleAddressSuggestions(req, res, url);
  if (req.method === "POST" && url.pathname === "/api/orders") return handleCreateOrder(req, res);
  if (req.method === "POST" && url.pathname === "/api/chat") return handleSiteChat(req, res);
  const tryOnJobMatch = url.pathname.match(/^\/api\/try-on\/jobs\/(tryon-job-[a-f0-9]{36})$/);
  if (tryOnJobMatch) return handleTryOnJob(req, res, tryOnJobMatch[1]);
  if (url.pathname === "/api/try-on") {
    return handleTryOn(req, res, {
      streamProgress: url.searchParams.get("progress") === "1",
      asyncJob: url.searchParams.get("async") === "1",
    });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/register") return handleRegister(req, res);
  if (req.method === "POST" && url.pathname === "/api/auth/login") return handleLogin(req, res);
  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    return json(res, 200, { ok: true }, { "Set-Cookie": clearCookie("hb_session") });
  }
  if (req.method === "GET" && url.pathname === "/api/auth/me") return handleMe(req, res);
  if (req.method === "GET" && url.pathname === "/api/auth/providers") return json(res, 200, { ok: true, providers: providerStatus() });
  if (req.method === "GET" && url.pathname === "/api/products") return handleProducts(req, res);
  if (req.method === "POST" && url.pathname === "/api/mobile/admin/login") return handleMobileAdminLogin(req, res);
  if (req.method === "GET" && url.pathname === "/api/mobile/admin/orders") return handleMobileAdminOrders(req, res, url);
  if (req.method === "GET" && url.pathname === "/api/mobile/admin/dashboard") return handleMobileAdminDashboard(req, res);
  if (url.pathname === "/api/mobile/admin/push-token") return handleMobilePushToken(req, res);
  const mobileShippingLabelMatch = url.pathname.match(/^\/api\/mobile\/admin\/orders\/([^/]+)\/shipping-label$/);
  if (mobileShippingLabelMatch) {
    return handleMobileShippingLabel(req, res, decodeURIComponent(mobileShippingLabelMatch[1]));
  }
  const mobileOrderMatch = url.pathname.match(/^\/api\/mobile\/admin\/orders\/([^/]+)$/);
  if (mobileOrderMatch) return handleMobileAdminOrder(req, res, decodeURIComponent(mobileOrderMatch[1]));
  if (req.method === "POST" && url.pathname === "/api/admin/login") return handleAdminLogin(req, res);
  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    return json(res, 200, { ok: true }, { "Set-Cookie": clearCookie("hb_admin") });
  }
  if (req.method === "GET" && url.pathname === "/api/admin/users") return handleAdminUsers(req, res);
  if (req.method === "GET" && url.pathname === "/api/admin/metrics") return handleAdminMetrics(req, res);
  if (req.method === "GET" && url.pathname === "/api/admin/replay") return handleAdminReplay(req, res, url);
  if (url.pathname === "/api/admin/try-on") return handleAdminTryOnArchive(req, res);
  if (url.pathname.startsWith("/api/admin/try-on/")) return handleAdminTryOnImage(req, res, url);
  if (url.pathname === "/api/admin/ai-product") {
    return handleAdminAiProduct(req, res, { streamProgress: url.searchParams.get("progress") === "1" });
  }
  if (url.pathname === "/api/admin/product-images") return handleAdminProductImages(req, res);
  if (url.pathname === "/api/admin/products") return handleAdminProducts(req, res);
  return notFound(res);
}

function safeStaticPath(urlPathname) {
  const requestedPathname = decodeURIComponent(urlPathname === "/" ? "/index.html" : urlPathname);
  const pathname = versionedPublicFiles.get(requestedPathname) || requestedPathname;
  if (pathname.startsWith("/uploads/")) {
    if (!publicAssetExtensions.has(path.extname(pathname).toLowerCase())) return null;
    const filePath = path.normalize(path.join(uploadsDir, pathname.replace(/^\/uploads\//, "")));
    if (!filePath.startsWith(uploadsDir)) return null;
    return filePath;
  }
  if (!publicFiles.has(pathname) && !pathname.startsWith("/assets/")) return null;
  if (pathname.startsWith("/assets/") && !publicAssetExtensions.has(path.extname(pathname).toLowerCase())) return null;
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) return null;
  return filePath;
}

async function serveProductImage(req, res, url) {
  if (!productImageStorage || !["GET", "HEAD"].includes(req.method || "")) return notFound(res);
  const rawName = decodeURIComponent(url.pathname.slice("/product-images/".length));
  const name = path.basename(rawName);
  if (!name || name !== rawName || !publicAssetExtensions.has(path.extname(name).toLowerCase())) return notFound(res);
  try {
    const object = await productImageStorage.send(new GetObjectCommand({
      Bucket: productImageBucketName,
      Key: `products/${name}`,
    }));
    const headers = {
      "Content-Type": object.ContentType || contentTypes[path.extname(name).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy": "geolocation=(self)",
    };
    if (Number.isFinite(Number(object.ContentLength))) headers["Content-Length"] = Number(object.ContentLength);
    if (object.ETag) headers.ETag = object.ETag;
    if (object.LastModified) headers["Last-Modified"] = object.LastModified.toUTCString();
    res.writeHead(200, headers);
    if (req.method === "HEAD" || !object.Body) return res.end();
    object.Body.on("error", () => res.destroy());
    return object.Body.pipe(res);
  } catch (error) {
    if (error?.name === "NoSuchKey" || error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
      return notFound(res);
    }
    throw error;
  }
}

async function serveStatic(req, res, url) {
  const filePath = safeStaticPath(url.pathname);
  if (!filePath) return notFound(res);
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    const imageAsset = [".png", ".jpg", ".jpeg", ".svg", ".webp", ".ico"].includes(ext);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy": "geolocation=(self)",
      "Cache-Control": ext === ".html"
        ? "no-cache"
        : imageAsset ? "public, max-age=31536000, immutable" : "public, max-age=604800",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    notFound(res);
  }
}

await fs.mkdir(dataDir, { recursive: true });
await ensureStorage();

const mobilePushQueueTimer = setInterval(() => {
  processMobilePushNotifications().catch((error) => {
    console.error(`[push] Scheduled notification retry failed: ${error.message}`);
  });
}, 60 * 1000);
mobilePushQueueTimer.unref?.();

http
  .createServer(async (req, res) => {
    try {
      const requestHostname = String(req.headers.host || "").split(":")[0].toLowerCase();
      if (requestHostname === apexHostname) {
        res.writeHead(308, {
          Location: `https://${canonicalHostname}${req.url || "/"}`,
          "Cache-Control": "public, max-age=3600",
        });
        return res.end();
      }
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const oauthStart = url.pathname.match(/^\/auth\/(google|microsoft)\/start$/);
      if (oauthStart) return startOauth(req, res, oauthStart[1]);
      const oauthEnd = url.pathname.match(/^\/auth\/(google|microsoft)\/callback$/);
      if (oauthEnd) return oauthCallback(req, res, oauthEnd[1], url);
      if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
      if (url.pathname.startsWith("/product-images/")) return await serveProductImage(req, res, url);
      return await serveStatic(req, res, url);
    } catch (error) {
      console.error(error);
      if (res.headersSent) return res.destroy();
      if (isStorageCapacityError(error)) {
        return json(res, 507, { ok: false, message: storageCapacityError().message });
      }
      json(res, 500, { ok: false, message: "Errore server." });
    }
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`Haller Boutique listening on ${port}`);
    setTimeout(() => processMobilePushNotifications().catch((error) => {
      console.error(`[push] Startup notification retry failed: ${error.message}`);
    }), 0);
    if (productImageStorage) {
      setTimeout(() => {
        verifyProductImageStorage()
          .then(() => {
            console.log("Tigris product image storage ready.");
          })
          .catch((error) => console.error(`Tigris storage verification failed: ${error.message}`));
        ensureProductImageStorage()
          .catch((error) => console.error(`Tigris CORS initialization skipped: ${error.message}`));
      }, 0);
    }
  });
