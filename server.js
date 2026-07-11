import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = __dirname;
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const usersFile = path.join(dataDir, "users.json");
const port = Number(process.env.PORT || 8080);
const sessionSecret = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const adminPassword = process.env.ADMIN_PASSWORD || "";

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
  try {
    await fs.access(usersFile);
  } catch {
    await fs.writeFile(usersFile, "[]\n", "utf8");
  }
}

async function readUsers() {
  await ensureStorage();
  const raw = await fs.readFile(usersFile, "utf8");
  return JSON.parse(raw || "[]");
}

async function writeUsers(users) {
  await ensureStorage();
  const tmp = `${usersFile}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(users, null, 2)}\n`, "utf8");
  await fs.rename(tmp, usersFile);
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
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
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
  if (req.method === "POST" && url.pathname === "/api/auth/register") return handleRegister(req, res);
  if (req.method === "POST" && url.pathname === "/api/auth/login") return handleLogin(req, res);
  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    return json(res, 200, { ok: true }, { "Set-Cookie": clearCookie("hb_session") });
  }
  if (req.method === "GET" && url.pathname === "/api/auth/me") return handleMe(req, res);
  if (req.method === "GET" && url.pathname === "/api/auth/providers") return json(res, 200, { ok: true, providers: providerStatus() });
  if (req.method === "POST" && url.pathname === "/api/admin/login") return handleAdminLogin(req, res);
  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    return json(res, 200, { ok: true }, { "Set-Cookie": clearCookie("hb_admin") });
  }
  if (req.method === "GET" && url.pathname === "/api/admin/users") return handleAdminUsers(req, res);
  return notFound(res);
}

function safeStaticPath(urlPathname) {
  const pathname = decodeURIComponent(urlPathname === "/" ? "/index.html" : urlPathname);
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
