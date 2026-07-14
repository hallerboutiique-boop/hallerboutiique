import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = __dirname;
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const usersFile = path.join(dataDir, "users.json");
const analyticsFile = path.join(dataDir, "analytics.json");
const ordersFile = path.join(dataDir, "orders.json");
const productsFile = path.join(dataDir, "products.json");
const uploadsDir = path.join(dataDir, "uploads");
const port = Number(process.env.PORT || 8080);
const sessionSecret = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const adminPassword = process.env.ADMIN_PASSWORD || "";
const openaiApiKey = process.env.OPENAI_API_KEY || "";
const openaiProductModel = process.env.OPENAI_PRODUCT_MODEL || "gpt-4.1-mini";
const openaiTryOnModel = process.env.OPENAI_TRYON_MODEL || "gpt-image-1.5";
const openaiTimeoutMs = 45000;
const analyticsRetentionMs = 365 * 24 * 60 * 60 * 1000;
const liveWindowMs = 2 * 60 * 1000;
const replayMaxEvents = 500;
const geoLookupTimeoutMs = 1800;
const geoCache = new Map();

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
  "/admin.html",
  "/styles.css",
  "/script.js",
  "/account.js",
  "/admin.js",
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
  await ensureJsonFile(productsFile, { items: {}, custom: [] });
  await fs.mkdir(uploadsDir, { recursive: true });
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
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
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

async function readProductOverrides() {
  const data = await readJson(productsFile, { items: {}, custom: [] });
  data.items = data.items && typeof data.items === "object" ? data.items : {};
  data.custom = Array.isArray(data.custom) ? data.custom : [];
  return data;
}

async function writeProductOverrides(data) {
  return writeJson(productsFile, {
    updatedAt: new Date().toISOString(),
    items: data.items && typeof data.items === "object" ? data.items : {},
    custom: Array.isArray(data.custom) ? data.custom : [],
  });
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
  return {
    ...product,
    ...override,
    id: product.id,
    baseName: product.name,
    custom: false,
    images: Array.isArray(override.images) ? override.images : product.images,
  };
}

function cleanProductImages(images) {
  const source = Array.isArray(images) ? images : String(images || "").split(/\r?\n/);
  return source
    .map((image) => cleanTrackingString(image, 260))
    .filter(Boolean)
    .filter((image) => image.startsWith("assets/") || image.startsWith("/") || /^https?:\/\//i.test(image))
    .slice(0, 8);
}

function cleanProductPatch(body) {
  const sizeType = ["clothing", "sneakers", "none"].includes(body.sizeType) ? body.sizeType : "none";
  return {
    name: cleanTrackingString(body.name, 180) || "Prodotto",
    description: cleanTrackingString(body.description, 700),
    original: cleanTrackingString(body.original, 40),
    finalPrice: cleanTrackingString(body.finalPrice, 40),
    discount: cleanTrackingString(body.discount, 20),
    collection: cleanTrackingString(body.collection, 80),
    category: cleanTrackingString(body.category, 80),
    sizeType,
    images: cleanProductImages(body.images),
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
    description: body.description,
    collection: body.collection,
    category: body.category,
    original: formatAiPrice(body.original),
    finalPrice: formatAiPrice(body.finalPrice),
    discount: body.discount,
    sizeType: body.sizeType,
    images: [imageUrl],
  });
  return {
    ...patch,
    confidence: cleanTrackingString(body.confidence, 40) || "media",
    sources: Array.isArray(body.sources) ? body.sources.map((source) => cleanTrackingString(source, 220)).filter(Boolean).slice(0, 4) : [],
  };
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
    required: ["name", "description", "collection", "category", "original", "finalPrice", "discount", "sizeType", "confidence", "sources"],
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      collection: { type: "string" },
      category: { type: "string" },
      original: { type: "string" },
      finalPrice: { type: "string" },
      discount: { type: "string" },
      sizeType: { type: "string", enum: ["clothing", "sneakers", "none"] },
      confidence: { type: "string", enum: ["alta", "media", "bassa"] },
      sources: { type: "array", items: { type: "string" } },
    },
  };
  const prompt = [
    "Analizza questa immagine prodotto per l'admin di Haller Boutique.",
    "Usa la ricerca web per verificare marca, modello e categoria quando possibile.",
    "Non inventare marchi o modelli non riconoscibili: se non sei sicuro, usa un nome generico premium.",
    "Scegli collection tra Catalogo Uomo, Catalogo Donna o Selezione Haller Boutique.",
    "Scegli category in italiano, ad esempio Sneakers Uomo, Sneakers Donna, Borse Uomo, Borse Donna, T-Shirts Uomo, Giacche Uomo, Accessori.",
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

async function readLocalProductImage(src) {
  const value = cleanTrackingString(src, 260);
  if (!value || /^https?:\/\//i.test(value)) return null;
  const pathname = value.startsWith("/") ? value : `/${value}`;
  const safePath = safeStaticPath(pathname.split("?")[0]);
  if (!safePath) return null;
  try {
    const data = await fs.readFile(safePath);
    const ext = path.extname(safePath).toLowerCase();
    const mime = contentTypes[ext]?.split(";")[0] || imageMimeFromExtension(ext);
    return { data, mime, filename: `product${ext || ".jpg"}` };
  } catch {
    return null;
  }
}

function appendImageFormData(form, field, image) {
  form.append(field, new Blob([image.data], { type: image.mime }), image.filename);
}

function buildTryOnForm({ userImage, productImage, productName, category, arrayField }) {
  const form = new FormData();
  const imageField = productImage && arrayField ? "image[]" : "image";
  appendImageFormData(form, imageField, userImage);
  if (productImage) appendImageFormData(form, imageField, productImage);
  form.append("model", openaiTryOnModel);
  form.append("size", "1024x1024");
  form.append("input_fidelity", "high");
  form.append(
    "prompt",
    [
      "Create a realistic virtual try-on preview for an ecommerce fashion site.",
      "Use the first image as the customer photo and keep the person's identity, face, body shape, pose and background natural.",
      productImage
        ? "Use the second image as the exact Haller Boutique product reference for the clothing style, color and visible details."
        : `Dress the person with this Haller Boutique item: ${productName || "fashion product"}.`,
      `Product name: ${productName || "Haller Boutique product"}. Category: ${category || "fashion"}.`,
      "Only change the outfit area needed for the product. Do not create nudity. Do not change age, face, body proportions or add unrelated logos.",
      "Return a premium, realistic square preview suitable for a product try-on modal.",
    ].join(" ")
  );
  return form;
}

async function requestTryOnEdit(form) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), openaiTimeoutMs);
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
    if (output?.b64_json) return `data:image/png;base64,${output.b64_json}`;
    if (output?.url) return output.url;
    throw new Error("Immagine try-on non ricevuta.");
  } finally {
    clearTimeout(timeout);
  }
}

async function generateTryOnImage(input) {
  const attempts = [
    buildTryOnForm({ ...input, arrayField: true }),
    buildTryOnForm({ ...input, arrayField: false }),
  ];
  let lastError;
  for (const form of attempts) {
    try {
      return await requestTryOnEdit(form);
    } catch (error) {
      lastError = error;
      if (error.status && error.status !== 400) break;
    }
  }
  throw lastError || new Error("Try-on non disponibile.");
}

function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", sessionSecret).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Date.now()) return null;
  return payload;
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
  if (String(body.password || "") !== adminPassword) return json(res, 401, { ok: false, message: "Password admin non corretta." });
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

async function handleProducts(req, res) {
  const data = await readProductOverrides();
  json(res, 200, { ok: true, items: data.items, custom: data.custom.map(mergeCustomProduct) });
}

async function handleAdminProducts(req, res) {
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: "Accesso admin richiesto." });
  const [defaults, overrides] = await Promise.all([readDefaultProducts(), readProductOverrides()]);

  if (req.method === "GET") {
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
  }

  if (req.method === "DELETE") {
    const body = await parseBody(req);
    const id = cleanTrackingString(body.id, 120);
    if (defaults.some((product) => product.id === id)) {
      delete overrides.items[id];
    } else {
      overrides.custom = overrides.custom.filter((product) => product.id !== id);
    }
    await writeProductOverrides(overrides);
    return json(res, 200, { ok: true });
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
    parts = parseMultipartBuffer(await readRequestBuffer(req, 10 * 1024 * 1024), boundary);
  } catch (error) {
    return badRequest(res, error.message || "Upload non valido.");
  }

  const productId = cleanTrackingString(parts.find((part) => part.name === "productId")?.data.toString("utf8"), 120);
  const [defaults, overrides] = await Promise.all([readDefaultProducts(), readProductOverrides()]);
  const base = defaults.find((product) => product.id === productId);
  const customIndex = overrides.custom.findIndex((product) => product.id === productId);
  if (!base && customIndex === -1) return badRequest(res, "Prodotto non valido.");

  await fs.mkdir(uploadsDir, { recursive: true });
  const saved = [];
  for (const part of parts.filter((entry) => entry.name === "images" && entry.filename)) {
    const ext = imageExtension(part.filename, part.contentType);
    if (!ext || part.data.length === 0) continue;
    const name = `${slugifyProduct(productId)}-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
    await fs.writeFile(path.join(uploadsDir, name), part.data);
    saved.push(`/uploads/${name}`);
  }

  if (saved.length === 0) return badRequest(res, "Nessuna immagine valida caricata.");

  let product;
  if (base) {
    const existing = overrides.items[productId] || {};
    overrides.items[productId] = {
      ...base,
      ...existing,
      id: undefined,
      baseName: undefined,
      images: [...cleanProductImages(existing.images), ...saved].slice(0, 8),
      updatedAt: new Date().toISOString(),
    };
    delete overrides.items[productId].id;
    delete overrides.items[productId].baseName;
    product = mergeProduct(base, overrides.items);
  } else {
    const existing = overrides.custom[customIndex];
    overrides.custom[customIndex] = cleanCustomProduct({
      ...existing,
      images: [...cleanProductImages(existing.images), ...saved].slice(0, 8),
    });
    product = mergeCustomProduct(overrides.custom[customIndex]);
  }
  await writeProductOverrides(overrides);

  json(res, 200, { ok: true, images: saved, product });
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
    parts = parseMultipartBuffer(await readRequestBuffer(req, 10 * 1024 * 1024), boundary);
  } catch (error) {
    return badRequest(res, error.message || "Upload non valido.");
  }

  const image = parts.find((part) => part.name === "image" && part.filename);
  if (!image || image.data.length === 0) return badRequest(res, "Carica una immagine prodotto.");
  const ext = imageExtension(image.filename, image.contentType);
  if (!ext || ext === ".svg") return badRequest(res, "Formato immagine non supportato per AI. Usa JPG, PNG o WebP.");

  const progress = streamProgress ? createProgressStream(res) : null;
  progress?.update(24, "Foto ricevuta");
  await fs.mkdir(uploadsDir, { recursive: true });
  const name = `ai-product-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
  await fs.writeFile(path.join(uploadsDir, name), image.data);
  const imageUrl = `/uploads/${name}`;
  const mime = image.contentType || (ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg");
  const dataUrl = `data:${mime};base64,${image.data.toString("base64")}`;
  progress?.update(42, "Foto preparata");

  try {
    progress?.update(58, "Ricerca e descrizione AI in corso");
    const rawSuggestion = await analyzeProductImageWithAi(dataUrl);
    progress?.update(90, "Dati prodotto ricevuti");
    const suggestion = cleanAiSuggestion(rawSuggestion, imageUrl);
    const result = { ok: true, image: imageUrl, suggestion };
    if (progress) return progress.done(result);
    json(res, 200, result);
  } catch (error) {
    const message = `AI non disponibile: ${cleanTrackingString(error.message, 220)}`;
    if (progress) return progress.fail(message);
    json(res, 502, { ok: false, message, image: imageUrl });
  }
}

async function handleTryOn(req, res, { streamProgress = false } = {}) {
  if (req.method !== "POST") return notFound(res);
  if (!openaiApiKey) {
    return json(res, 503, {
      ok: false,
      message: "Try-on AI non configurato. Imposta OPENAI_API_KEY su Fly.",
    });
  }

  const contentType = String(req.headers["content-type"] || "");
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) return badRequest(res, "Upload non valido.");

  let parts;
  try {
    parts = parseMultipartBuffer(await readRequestBuffer(req), boundary);
  } catch (error) {
    return badRequest(res, error.message || "Upload non valido.");
  }

  const image = parts.find((part) => part.name === "userImage" && part.filename);
  if (!image || image.data.length === 0) return badRequest(res, "Carica una tua foto.");
  const ext = imageExtension(image.filename, image.contentType);
  if (!ext || ext === ".svg") return badRequest(res, "Formato immagine non supportato. Usa JPG, PNG o WebP.");

  const progress = streamProgress ? createProgressStream(res) : null;
  progress?.update(24, "Foto ricevuta");
  const productName = fieldValue(parts, "productName", 180);
  const category = fieldValue(parts, "category", 120);
  const productImageSrc = fieldValue(parts, "productImage", 260);
  const productImage = await readLocalProductImage(productImageSrc);
  const userImage = {
    data: image.data,
    mime: image.contentType || imageMimeFromExtension(ext),
    filename: `customer${ext}`,
  };

  try {
    progress?.update(46, "Prodotto preparato");
    progress?.update(60, "Generazione try-on AI in corso");
    const generated = await generateTryOnImage({ userImage, productImage, productName, category });
    progress?.update(92, "Anteprima ricevuta");
    const result = { ok: true, image: generated };
    if (progress) return progress.done(result);
    json(res, 200, result);
  } catch (error) {
    const message = `Try-on non disponibile: ${cleanTrackingString(error.message, 220)}`;
    if (progress) return progress.fail(message);
    json(res, 502, { ok: false, message });
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
  const analytics = await readAnalytics();
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

  await writeAnalytics(analytics);
  json(res, 200, { ok: true, sessionId });
}

function cleanProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.slice(0, 20).map((product) => {
    const price = cleanTrackingString(product.price, 40);
    const quantity = Math.max(1, Math.min(99, Number.parseInt(product.quantity || 1, 10) || 1));
    return {
      name: cleanTrackingString(product.name, 180) || "Prodotto",
      price,
      size: cleanTrackingString(product.size || product.variant, 40),
      quantity,
      value: parseEuro(price) * quantity,
    };
  });
}

async function handleCreateOrder(req, res) {
  const body = await parseBody(req);
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
    sessionId,
    visitorId: cleanTrackingString(body.visitorId, 80),
    customer: {
      name: cleanTrackingString(body.customer?.name, 120),
      email: cleanEmail(body.customer?.email),
      phone: cleanTrackingString(body.customer?.phone, 60),
      city: cleanTrackingString(body.customer?.city, 80),
      postalCode: cleanTrackingString(body.customer?.postalCode, 20),
      address: cleanTrackingString(body.customer?.address, 180),
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
  };

  const orders = await readOrders();
  orders.push(order);
  await writeOrders(orders.slice(-2000));

  const analytics = await readAnalytics();
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
  await writeAnalytics(analytics);

  json(res, 201, { ok: true, order: { id: order.id, orderCode: order.orderCode, total: order.total } });
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
  if (req.method === "POST" && url.pathname === "/api/consent") return handleConsent(req, res);
  if (req.method === "POST" && url.pathname === "/api/track") return handleTrack(req, res);
  if (req.method === "POST" && url.pathname === "/api/orders") return handleCreateOrder(req, res);
  if (url.pathname === "/api/try-on") return handleTryOn(req, res, { streamProgress: url.searchParams.get("progress") === "1" });
  if (req.method === "POST" && url.pathname === "/api/auth/register") return handleRegister(req, res);
  if (req.method === "POST" && url.pathname === "/api/auth/login") return handleLogin(req, res);
  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    return json(res, 200, { ok: true }, { "Set-Cookie": clearCookie("hb_session") });
  }
  if (req.method === "GET" && url.pathname === "/api/auth/me") return handleMe(req, res);
  if (req.method === "GET" && url.pathname === "/api/auth/providers") return json(res, 200, { ok: true, providers: providerStatus() });
  if (req.method === "GET" && url.pathname === "/api/products") return handleProducts(req, res);
  if (req.method === "POST" && url.pathname === "/api/admin/login") return handleAdminLogin(req, res);
  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    return json(res, 200, { ok: true }, { "Set-Cookie": clearCookie("hb_admin") });
  }
  if (req.method === "GET" && url.pathname === "/api/admin/users") return handleAdminUsers(req, res);
  if (req.method === "GET" && url.pathname === "/api/admin/metrics") return handleAdminMetrics(req, res);
  if (req.method === "GET" && url.pathname === "/api/admin/replay") return handleAdminReplay(req, res, url);
  if (url.pathname === "/api/admin/ai-product") {
    return handleAdminAiProduct(req, res, { streamProgress: url.searchParams.get("progress") === "1" });
  }
  if (url.pathname === "/api/admin/product-images") return handleAdminProductImages(req, res);
  if (url.pathname === "/api/admin/products") return handleAdminProducts(req, res);
  return notFound(res);
}

function safeStaticPath(urlPathname) {
  const pathname = decodeURIComponent(urlPathname === "/" ? "/index.html" : urlPathname);
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

async function serveStatic(req, res, url) {
  const filePath = safeStaticPath(url.pathname);
  if (!filePath) return notFound(res);
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy": "geolocation=(self)",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=604800",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    notFound(res);
  }
}

await ensureStorage();

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const oauthStart = url.pathname.match(/^\/auth\/(google|microsoft)\/start$/);
      if (oauthStart) return startOauth(req, res, oauthStart[1]);
      const oauthEnd = url.pathname.match(/^\/auth\/(google|microsoft)\/callback$/);
      if (oauthEnd) return oauthCallback(req, res, oauthEnd[1], url);
      if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
      return serveStatic(req, res, url);
    } catch (error) {
      console.error(error);
      json(res, 500, { ok: false, message: "Errore server." });
    }
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`Haller Boutique listening on ${port}`);
  });
