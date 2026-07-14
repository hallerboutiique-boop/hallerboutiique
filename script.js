const slides = Array.from(document.querySelectorAll(".hero-slide"));
const heroSlider = document.querySelector(".hero-slider");
let active = 0;
let tryOnProduct = null;
let tryOnPreviewUrl = "";
let revealObserver = null;
let siteMotionEnabled = false;
let motionEventsBound = false;
let motionScrollFrame = 0;
let motionScrollDirection = "down";
let lastMotionScrollY = window.scrollY;

const clothingSizes = ["S", "M", "L", "XL", "XXL"];
const sneakerSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
let productOverrides = {};
let customProducts = [];
const cartKey = "hallerBoutiqueCartCount";
const cartItemsKey = "hallerBoutiqueCartItems";
const checkoutItemKey = "hallerBoutiqueCheckoutItem";
const orderCodeKey = "hallerBoutiqueOrderCode";
const visitorIdKey = "hallerBoutiqueVisitorId";
const serverVisitorIdKey = "hallerBoutiqueServerVisitorId";
const analyticsSessionKey = "hallerBoutiqueSessionId";
const analyticsSessionStartedKey = "hallerBoutiqueSessionStartedAt";
const consentKey = "hallerBoutiqueConsent";
const consentVersion = 2;
const isReplayView = new URLSearchParams(window.location.search).get("replay_view") === "1";
let runtimeConsent = null;

function randomId(prefix) {
  const bytes =
    window.crypto && window.crypto.getRandomValues
      ? Array.from(window.crypto.getRandomValues(new Uint8Array(10)))
      : Array.from({ length: 10 }, () => Math.floor(Math.random() * 256));
  return `${prefix}_${bytes.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function readConsent() {
  if (runtimeConsent && runtimeConsent.version === consentVersion) {
    return {
      analytics: Boolean(runtimeConsent.analytics),
      replay: Boolean(runtimeConsent.replay),
      location: Boolean(runtimeConsent.location),
      choice: runtimeConsent.choice || "custom",
    };
  }
  try {
    const consent = JSON.parse(window.localStorage.getItem(consentKey));
    return consent && consent.version === consentVersion
      ? {
          analytics: Boolean(consent.analytics),
          replay: Boolean(consent.replay),
          location: Boolean(consent.location),
          choice: consent.choice || "custom",
        }
      : null;
  } catch {
    return null;
  }
}

function saveConsent(consent) {
  const nextConsent = {
    version: consentVersion,
    analytics: Boolean(consent.analytics || consent.replay || consent.location),
    replay: Boolean(consent.replay),
    location: Boolean(consent.location),
    choice: consent.choice || "custom",
    savedAt: new Date().toISOString(),
  };
  runtimeConsent = nextConsent;
  try {
    window.localStorage.setItem(consentKey, JSON.stringify(nextConsent));
  } catch {
    // Some embedded/live browser previews block storage; keep this consent for the current page session.
  }
  if (!nextConsent.replay) {
    analyticsState.replayBuffer = [];
  }
  if (!nextConsent.location) {
    analyticsState.preciseLocation = null;
    analyticsState.locationRequested = false;
  }
  renderConsentManager();
  syncConsentServer(nextConsent).finally(() => {
    if (nextConsent.analytics) {
      startConsentedTracking();
    }
  });
}

function hasAnalyticsConsent() {
  if (isReplayView) return false;
  return Boolean(readConsent()?.analytics);
}

function hasReplayConsent() {
  if (isReplayView) return false;
  return Boolean(readConsent()?.replay);
}

function hasLocationConsent() {
  if (isReplayView) return false;
  const consent = readConsent();
  return Boolean(consent?.analytics && consent?.location);
}

function getVisitorId() {
  let id = window.localStorage.getItem(serverVisitorIdKey) || window.localStorage.getItem(visitorIdKey);
  if (!id) {
    id = randomId("vis");
    window.localStorage.setItem(visitorIdKey, id);
  }
  return id;
}

function getAnalyticsSessionId() {
  let id = window.sessionStorage.getItem(analyticsSessionKey);
  if (!id) {
    id = randomId("ses");
    window.sessionStorage.setItem(analyticsSessionKey, id);
    window.sessionStorage.setItem(analyticsSessionStartedKey, String(Date.now()));
  }
  return id;
}

const analyticsState = {
  visitorId: "",
  sessionId: "",
  startedAt: Date.now(),
  maxScroll: 0,
  initialized: false,
  started: false,
  replayStarted: false,
  replayBuffer: [],
  replayFlushTimer: 0,
  lastMoveAt: 0,
  lastScrollAt: 0,
  preciseLocation: null,
  locationRequested: false,
  locationRequestToken: 0,
};

const deviceInfoState = {};

function baseDeviceInfo() {
  return {
    platform: navigator.platform || "",
    language: navigator.language || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
    viewportWidth: window.innerWidth || 0,
    viewportHeight: window.innerHeight || 0,
    pixelRatio: window.devicePixelRatio || 1,
    touchPoints: navigator.maxTouchPoints || 0,
  };
}

async function refreshDeviceInfo() {
  Object.assign(deviceInfoState, baseDeviceInfo());
  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const hints = await navigator.userAgentData.getHighEntropyValues([
        "architecture",
        "bitness",
        "model",
        "platform",
        "platformVersion",
        "uaFullVersion",
        "fullVersionList",
      ]);
      Object.assign(deviceInfoState, {
        architecture: hints.architecture || "",
        bitness: hints.bitness || "",
        model: hints.model || "",
        platform: hints.platform || deviceInfoState.platform,
        platformVersion: hints.platformVersion || "",
        mobile: Boolean(navigator.userAgentData.mobile),
        uaFullVersion: hints.uaFullVersion || "",
        fullVersionList: Array.isArray(hints.fullVersionList)
          ? hints.fullVersionList.map((item) => `${item.brand} ${item.version}`).join(", ")
          : "",
      });
    } catch {
      // Safari and some privacy modes do not expose high entropy client hints.
    }
  }
  return deviceInfoState;
}

function currentDeviceInfo() {
  Object.assign(deviceInfoState, baseDeviceInfo());
  return { ...deviceInfoState };
}

function cleanCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : null;
}

function preciseLocationFromPosition(position) {
  const coords = position?.coords || {};
  const latitude = cleanCoordinate(coords.latitude, -90, 90);
  const longitude = cleanCoordinate(coords.longitude, -180, 180);
  if (latitude === null || longitude === null) return null;
  return {
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    accuracy: Math.max(0, Math.round(Number(coords.accuracy || 0))),
    altitude: Number.isFinite(coords.altitude) ? Number(coords.altitude.toFixed(2)) : null,
    altitudeAccuracy: Number.isFinite(coords.altitudeAccuracy) ? Math.max(0, Math.round(coords.altitudeAccuracy)) : null,
    heading: Number.isFinite(coords.heading) ? Math.max(0, Math.min(360, Math.round(coords.heading))) : null,
    speed: Number.isFinite(coords.speed) ? Math.max(0, Number(coords.speed.toFixed(2))) : null,
    capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
  };
}

function currentPreciseLocation() {
  return analyticsState.preciseLocation ? { ...analyticsState.preciseLocation } : null;
}

function locationErrorName(error) {
  if (!error) return "unavailable";
  if (error.code === 1) return "denied";
  if (error.code === 2) return "unavailable";
  if (error.code === 3) return "timeout";
  return "error";
}

function setLocationBannerStatus(text) {
  const label = document.querySelector("[data-location-delivery-banner] span");
  if (label && text) label.textContent = text;
}

function sendLocationTrack(type, extra = {}) {
  try {
    sendTrack(type, extra);
  } catch {
    // The location prompt must keep working even when analytics storage is unavailable.
  }
}

function locationPermissionHelpMessage() {
  const appleDevice = /iPhone|iPad|Macintosh|Mac OS X/i.test(navigator.userAgent || "");
  if (appleDevice) {
    return "Se non vedi il popup, abilita Localizzazione per il browser nelle impostazioni Apple e tocca per riprovare.";
  }
  return "Se non vedi il popup, abilita Posizione dalle impostazioni del browser e tocca per riprovare.";
}

function requestPreciseLocation(reason = "consent", options = {}) {
  if (!hasLocationConsent()) return;
  if (analyticsState.locationRequested && !options.force) return;
  analyticsState.locationRequested = true;
  const requestToken = analyticsState.locationRequestToken + 1;
  analyticsState.locationRequestToken = requestToken;

  if (window.isSecureContext === false) {
    setLocationBannerStatus("Apri il sito in HTTPS per autorizzare la posizione.");
    sendLocationTrack("precise_location_status", {
      preciseLocationStatus: "insecure_context",
      locationReason: reason,
    });
    analyticsState.locationRequested = false;
    return;
  }

  if (!navigator.geolocation) {
    setLocationBannerStatus("Questo browser non supporta la localizzazione. Apri il sito da Safari o Chrome.");
    sendLocationTrack("precise_location_status", {
      preciseLocationStatus: "unsupported",
      locationReason: reason,
    });
    analyticsState.locationRequested = false;
    return;
  }

  if (options.userInitiated) {
    setLocationBannerStatus("Autorizza la posizione nel popup del browser.");
  }

  const helpTimer = options.userInitiated
    ? window.setTimeout(() => {
        if (analyticsState.locationRequestToken === requestToken && !analyticsState.preciseLocation) {
          setLocationBannerStatus(locationPermissionHelpMessage());
        }
      }, 2500)
    : 0;

  const finishLocationRequest = () => {
    if (helpTimer) window.clearTimeout(helpTimer);
  };

  navigator.geolocation.getCurrentPosition(
    (position) => {
      finishLocationRequest();
      const preciseLocation = preciseLocationFromPosition(position);
      if (!preciseLocation) {
        setLocationBannerStatus("Posizione non disponibile. Riprova tra poco.");
        sendLocationTrack("precise_location_status", {
          preciseLocationStatus: "unavailable",
          locationReason: reason,
        });
        return;
      }
      analyticsState.preciseLocation = preciseLocation;
      const accuracy = Number.isFinite(preciseLocation.accuracy) ? ` ±${preciseLocation.accuracy}m` : "";
      setLocationBannerStatus(`Localizzazione attiva. Tempi di consegna in tempo reale${accuracy}.`);
      sendLocationTrack("precise_location", {
        preciseLocation,
        preciseLocationStatus: "granted",
        locationReason: reason,
      });
    },
    (error) => {
      finishLocationRequest();
      const status = locationErrorName(error);
      const messages = {
        denied: "Permesso posizione negato. Clicca sul lucchetto del sito e imposta Posizione su Consenti.",
        timeout: locationPermissionHelpMessage(),
        unavailable: "Posizione non disponibile. Attiva il GPS del dispositivo e tocca per riprovare.",
        error: "Errore posizione. Tocca per riprovare.",
      };
      setLocationBannerStatus(messages[status] || "Posizione non disponibile. Tocca per riprovare.");
      sendLocationTrack("precise_location_status", {
        preciseLocationStatus: status,
        locationError: error?.message || "",
        locationReason: reason,
      });
      analyticsState.locationRequested = false;
    },
    {
      enableHighAccuracy: true,
      timeout: 18000,
      maximumAge: 60000,
    }
  );
}

function initAnalyticsState() {
  if (!analyticsState.initialized) {
    analyticsState.visitorId = getVisitorId();
    analyticsState.sessionId = getAnalyticsSessionId();
    analyticsState.startedAt = Number(window.sessionStorage.getItem(analyticsSessionStartedKey) || Date.now());
    analyticsState.initialized = true;
  }
  return analyticsState;
}

async function syncConsentServer(consent) {
  if (isReplayView) return;
  if (!consent?.analytics && !consent?.replay) {
    window.localStorage.removeItem(serverVisitorIdKey);
  }
  try {
    const response = await fetch("/api/consent", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analytics: Boolean(consent?.analytics),
        replay: Boolean(consent?.replay),
        location: Boolean(consent?.location),
        deviceInfo: currentDeviceInfo(),
      }),
      keepalive: true,
    });
    const data = await response.json();
    if (data.visitorId) {
      window.localStorage.setItem(serverVisitorIdKey, data.visitorId);
      analyticsState.visitorId = data.visitorId;
    }
  } catch {
    // Tracking still works with the local first-party id if Safari blocks this request.
  }
}

function trackingIds() {
  if (!hasAnalyticsConsent()) return { visitorId: "", sessionId: "" };
  initAnalyticsState();
  return { visitorId: analyticsState.visitorId, sessionId: analyticsState.sessionId };
}

function sessionDurationMs() {
  if (!analyticsState.initialized) return 0;
  return Date.now() - analyticsState.startedAt;
}

function currentScrollDepth() {
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const depth = Math.round((window.scrollY / scrollable) * 100);
  analyticsState.maxScroll = Math.max(analyticsState.maxScroll, Math.min(100, Math.max(0, depth)));
  return analyticsState.maxScroll;
}

function sendTrack(type, extra = {}) {
  if (!hasAnalyticsConsent()) return;
  initAnalyticsState();
  const payload = {
    type,
    visitorId: analyticsState.visitorId,
    sessionId: analyticsState.sessionId,
    replayConsent: hasReplayConsent(),
    path: window.location.pathname,
    title: document.title,
    referrer: document.referrer,
    durationMs: sessionDurationMs(),
    scrollDepth: currentScrollDepth(),
    deviceInfo: currentDeviceInfo(),
    preciseLocation: currentPreciseLocation(),
    ...extra,
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function cleanReplayText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function replayTarget(element) {
  if (!element) return "";
  const target = element.closest("button, a, input, select, textarea, label, .product-card, .payment-option");
  if (!target) return element.tagName ? element.tagName.toLowerCase() : "";
  if (target.matches("input, textarea, select")) {
    return `${target.tagName.toLowerCase()}[${target.getAttribute("name") || target.type || "field"}]`;
  }
  if (target.matches("button, a")) {
    return cleanReplayText(target.textContent) || target.tagName.toLowerCase();
  }
  return cleanReplayText(target.getAttribute("aria-label") || target.className || target.tagName.toLowerCase());
}

function recordReplay(type, data = {}) {
  if (!hasReplayConsent()) return;
  initAnalyticsState();
  analyticsState.replayBuffer.push({
    type,
    t: sessionDurationMs(),
    w: window.innerWidth,
    h: window.innerHeight,
    ...data,
  });
  if (analyticsState.replayBuffer.length >= 24) {
    flushReplay("batch");
  }
}

function flushReplay(reason = "flush") {
  if (!hasReplayConsent() || analyticsState.replayBuffer.length === 0) return;
  const replay = analyticsState.replayBuffer.splice(0, analyticsState.replayBuffer.length);
  sendTrack("replay", { replay, replayReason: reason });
}

function setupReplayRecorder() {
  if (analyticsState.replayStarted || !hasReplayConsent()) return;
  analyticsState.replayStarted = true;
  recordReplay("page", {
    target: document.title,
    scrollY: window.scrollY,
    depth: currentScrollDepth(),
  });

  document.addEventListener(
    "pointermove",
    (event) => {
      const now = Date.now();
      if (now - analyticsState.lastMoveAt < 450) return;
      analyticsState.lastMoveAt = now;
      recordReplay("move", { x: Math.round(event.clientX), y: Math.round(event.clientY) });
    },
    { passive: true }
  );

  document.addEventListener(
    "click",
    (event) => {
      recordReplay("click", {
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
        target: replayTarget(event.target),
        text: event.target?.matches?.("input, textarea") ? "" : cleanReplayText(event.target?.textContent),
      });
      flushReplay("click");
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      const now = Date.now();
      if (now - analyticsState.lastScrollAt < 350) return;
      analyticsState.lastScrollAt = now;
      recordReplay("scroll", { scrollY: Math.round(window.scrollY), depth: currentScrollDepth() });
    },
    { passive: true }
  );

  window.addEventListener(
    "resize",
    () => {
      recordReplay("resize", { w: window.innerWidth, h: window.innerHeight });
    },
    { passive: true }
  );

  document.addEventListener(
    "input",
    (event) => {
      const field = event.target;
      if (!field?.matches?.("input, textarea, select")) return;
      recordReplay("input", {
        target: replayTarget(field),
        field: field.getAttribute("name") || field.type || field.tagName.toLowerCase(),
        text: field.type === "password" ? "campo protetto" : "campo modificato",
      });
    },
    { passive: true }
  );

  analyticsState.replayFlushTimer = window.setInterval(() => flushReplay("timer"), 10000);
}

async function startConsentedTracking() {
  if (!hasAnalyticsConsent()) return;
  initAnalyticsState();
  await refreshDeviceInfo();
  if (!analyticsState.started) {
    analyticsState.started = true;
    sendTrack("pageview");
    if (document.querySelector(".checkout-page")) {
      sendTrack("checkout_start", { product: getCheckoutProductText() });
      recordReplay("checkout", { target: getCheckoutProductText(), depth: currentScrollDepth() });
    }
  }
  setupReplayRecorder();
}

function consentBannerMarkup(consent) {
  const analyticsChecked = consent?.analytics ? "checked" : "";
  const replayChecked = consent?.replay ? "checked" : "";
  const locationChecked = consent?.location ? "checked" : "";
  return `
    <section class="cookie-banner" data-cookie-banner aria-label="Preferenze cookie">
      <div class="cookie-copy">
        <span>Privacy Haller Boutique</span>
        <h2>Cookie, sessione e posizione</h2>
        <p>Usiamo cookie tecnici per far funzionare il sito. Con il tuo consenso possiamo raccogliere metriche, replay sessione e posizione precisa del dispositivo per sicurezza, ordini e analisi visite. Password, pagamenti e valori dei campi non vengono registrati.</p>
      </div>
      <div class="cookie-options" data-cookie-options hidden>
        <label>
          <input type="checkbox" checked disabled>
          <span>Necessari</span>
          <small>Carrello, checkout, login e preferenza consenso.</small>
        </label>
        <label>
          <input type="checkbox" data-consent-analytics ${analyticsChecked}>
          <span>Metriche sito</span>
          <small>Visite, dispositivo, browser, pagine, conversione.</small>
        </label>
        <label>
          <input type="checkbox" data-consent-replay ${replayChecked}>
          <span>Replay sessione</span>
          <small>Movimenti, click e scroll mascherando gli input.</small>
        </label>
        <label>
          <input type="checkbox" data-consent-location ${locationChecked}>
          <span>Posizione precisa</span>
          <small>Coordinate GPS, accuratezza in metri e orario, solo se autorizzi il popup del browser.</small>
        </label>
      </div>
      <div class="cookie-actions">
        <button type="button" data-consent-reject>Solo necessari</button>
        <button type="button" data-consent-metrics>Solo metriche</button>
        <button type="button" data-consent-custom>Personalizza</button>
        <button type="button" data-consent-save hidden>Salva preferenze</button>
        <button type="button" data-consent-accept>Accetta tutto</button>
      </div>
    </section>
  `;
}

function renderConsentManager(forceBanner = false) {
  document.querySelector("[data-cookie-banner]")?.remove();
  const consent = readConsent();

  if (consent && !forceBanner) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = consentBannerMarkup(consent);
  const banner = wrapper.firstElementChild;
  document.body.appendChild(banner);

  const options = banner.querySelector("[data-cookie-options]");
  const analyticsToggle = banner.querySelector("[data-consent-analytics]");
  const replayToggle = banner.querySelector("[data-consent-replay]");
  const locationToggle = banner.querySelector("[data-consent-location]");
  const saveButton = banner.querySelector("[data-consent-save]");
  const customButton = banner.querySelector("[data-consent-custom]");

  function closeWith(nextConsent) {
    saveConsent(nextConsent);
    if (nextConsent.location) {
      requestPreciseLocation("consent_choice", { force: true, userInitiated: true });
    }
    banner.remove();
  }

  banner.querySelector("[data-consent-reject]")?.addEventListener("click", () => {
    closeWith({ analytics: false, replay: false, location: false, choice: "necessary" });
  });

  banner.querySelector("[data-consent-metrics]")?.addEventListener("click", () => {
    closeWith({ analytics: true, replay: false, location: false, choice: "analytics" });
  });

  banner.querySelector("[data-consent-accept]")?.addEventListener("click", () => {
    closeWith({ analytics: true, replay: true, location: true, choice: "all" });
  });

  customButton?.addEventListener("click", () => {
    options.hidden = false;
    saveButton.hidden = false;
    customButton.hidden = true;
  });

  replayToggle?.addEventListener("change", () => {
    if (replayToggle.checked) analyticsToggle.checked = true;
  });

  analyticsToggle?.addEventListener("change", () => {
    if (!analyticsToggle.checked) replayToggle.checked = false;
    if (!analyticsToggle.checked) locationToggle.checked = false;
  });

  locationToggle?.addEventListener("change", () => {
    if (locationToggle.checked) analyticsToggle.checked = true;
  });

  saveButton?.addEventListener("click", () => {
    closeWith({
      analytics: analyticsToggle.checked,
      replay: replayToggle.checked,
      location: locationToggle.checked,
      choice: "custom",
    });
  });
}

function requestLocationFromBanner(event) {
  event?.preventDefault?.();
  if (event?.hallerLocationHandled) return;
  if (event) event.hallerLocationHandled = true;

  const current = readConsent() || {};
  const nextConsent = {
    analytics: true,
    replay: Boolean(current.replay),
    location: true,
    choice: "delivery_location",
  };
  runtimeConsent = {
    version: consentVersion,
    ...nextConsent,
    savedAt: new Date().toISOString(),
  };

  setLocationBannerStatus("Autorizza la posizione nel popup del browser.");
  requestPreciseLocation("delivery_banner", { force: true, userInitiated: true });
  saveConsent(nextConsent);
}

window.HallerLocation = {
  requestFromBanner: requestLocationFromBanner,
};

function setupLocationDeliveryBanner() {
  const banner = document.querySelector("[data-location-delivery-banner]");
  if (banner && !banner.dataset.locationBound) {
    banner.dataset.locationBound = "1";
    banner.addEventListener("click", requestLocationFromBanner);
  }
}

const cryptoWallets = {
  btc: {
    title: "BTC",
    network: "Bitcoin",
    address: "bc1pp5x4xdu8m9mxhpuvntp69p7u0dl726h8ex8sjv577ffuwr32d2vsgyp0jm",
    qrData: (orderCode) =>
      `bitcoin:bc1pp5x4xdu8m9mxhpuvntp69p7u0dl726h8ex8sjv577ffuwr32d2vsgyp0jm?message=${encodeURIComponent(orderCode)}`,
  },
  usdc: {
    title: "USDC",
    network: "Base",
    address: "0xA6Bb39f60D5B5856334F6A49039a49070b0706BE",
    qrData: () => "0xA6Bb39f60D5B5856334F6A49039a49070b0706BE",
  },
  usdt: {
    title: "USDT",
    network: "TRON",
    address: "TXSJ3Jw2Nbv8mYAzJN9DBrspvZGEv2QQJi",
    qrData: () => "TXSJ3Jw2Nbv8mYAzJN9DBrspvZGEv2QQJi",
  },
  sol: {
    title: "SOL",
    network: "SOL",
    address: "9R1DW4VswpiJ5KxmfqGVsrH5o4QRKi9yBBh3LBPkRMmz",
    qrData: (orderCode) =>
      `solana:9R1DW4VswpiJ5KxmfqGVsrH5o4QRKi9yBBh3LBPkRMmz?label=${encodeURIComponent("Haller Boutique")}&message=${encodeURIComponent(orderCode)}&memo=${encodeURIComponent(orderCode)}`,
  },
};

const euro = (value) => `${value}\u20ac`;

function item(name, original, finalPrice, discount, sizeType) {
  return {
    name,
    original: euro(original),
    finalPrice: euro(finalPrice),
    discount,
    sizeType,
  };
}

function bulk(names, original, finalPrice, discount, sizeType) {
  return names.map((name) => item(name, original, finalPrice, discount, sizeType));
}

const catalogSections = [
  {
    id: "uomo",
    title: "Catalogo Uomo",
    categories: [
      {
        name: "T-Shirts",
        discount: "-30%",
        products: bulk(
          [
            "T-Shirt Balenciaga",
            "T-Shirt Stone Island",
            "T-Shirt Givenchy",
            "T-Shirt Moncler",
            "T-Shirt Gucci",
            "T-Shirt Louis Vuitton",
            "T-Shirt Off-White Tom & Jerry",
          ],
          "99,99",
          "69,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Polo",
        discount: "-40%",
        products: [item("Polo Gucci", "133,32", "79,99", "-40%", "clothing")],
      },
      {
        name: "Tracksuits",
        discount: "-45%",
        products: [
          item("Tracksuit Nike Nocta", "290,89", "159,99", "-45%", "clothing"),
          item("Tracksuit Polo Ralph Lauren", "290,89", "159,99", "-45%", "clothing"),
          item("Tracksuit Emporio Armani", "218,16", "119,99", "-45%", "clothing"),
        ],
      },
      {
        name: "Two-Piece Sets",
        discount: "-30%",
        products: bulk(
          ["Two-Piece Set Moschino", "Two-Piece Set Gucci"],
          "142,84",
          "99,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Jackets",
        discount: "-30%",
        products: bulk(
          ["Jacket Stone Island", "Jacket Balenciaga"],
          "128,56",
          "89,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Long Denim",
        discount: "-30%",
        products: [item("Long Denim Dsquared", "114,27", "79,99", "-30%", "clothing")],
      },
      {
        name: "Denim Shorts",
        discount: "-30%",
        products: bulk(
          ["Denim Shorts Louis Vuitton", "Denim Shorts Gucci", "Denim Shorts Dsquared"],
          "99,99",
          "69,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Shorts",
        discount: "-30%",
        products: [item("EA7 Red Shorts", "85,70", "59,99", "-30%", "clothing")],
      },
      {
        name: "Borse Uomo",
        discount: "-30%",
        products: [
          item("Crossbody Bag Gucci", "171,41", "119,99", "-30%", "none"),
          item("Crossbody Bag Louis Vuitton", "185,70", "129,99", "-30%", "none"),
          item("Dogon Wallet Herm\u00e8s", "185,70", "129,99", "-30%", "none"),
          item("Card Holder Herm\u00e8s", "157,13", "109,99", "-30%", "none"),
        ],
      },
      {
        name: "Sneakers Uomo",
        discount: "-45%",
        products: [
          item("Air Jordan", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Shox Full Black", "163,62", "89,99", "-45%", "sneakers"),
          item("Nike TN Full Black", "145,44", "79,99", "-45%", "sneakers"),
          item("Nike TN Full White", "145,44", "79,99", "-45%", "sneakers"),
          item("Nike Air Force Panda", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Air Force Black/White", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Air Force Full White", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Air Force Louis Vuitton Red", "254,53", "139,99", "-45%", "sneakers"),
          item("Nike Air Force Chunky Laces", "254,53", "139,99", "-45%", "sneakers"),
          item("Gucci Ace Green/Red", "254,53", "139,99", "-45%", "sneakers"),
          item("Louis Vuitton Trainer White/Black", "272,71", "149,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Black/White", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Brown", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Beige/White", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Black/Grey", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Green", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Blue", "290,89", "159,99", "-45%", "sneakers"),
          item("Balenciaga Track Full Black", "309,07", "169,99", "-45%", "sneakers"),
          item("Alexander McQueen Black Laces", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Grey/White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Sky Blue", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic", "272,71", "149,99", "-45%", "sneakers"),
        ],
      },
    ],
  },
  {
    id: "donna",
    title: "Catalogo Donna",
    categories: [
      {
        name: "T-Shirts",
        discount: "-30%",
        products: bulk(
          ["T-Shirt Louis Vuitton", "T-Shirt Palm Angels"],
          "99,99",
          "69,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Borse Donna",
        discount: "-30%",
        products: [
          item("Bag Louis Vuitton", "357,13", "249,99", "-30%", "none"),
          item("Backpack Louis Vuitton", "471,41", "329,99", "-30%", "none"),
          item("Mini Bag Herm\u00e8s", "157,13", "109,99", "-30%", "none"),
          item("Flap Bag Chanel", "214,27", "149,99", "-30%", "none"),
          item("Baguette Bag Fendi", "199,99", "139,99", "-30%", "none"),
          item("Kelly Bag Herm\u00e8s", "271,41", "189,99", "-30%", "none"),
          item("Wallet Bag Herm\u00e8s", "199,99", "139,99", "-30%", "none"),
          item("Dogon Wallet Herm\u00e8s", "185,70", "129,99", "-30%", "none"),
        ],
      },
      {
        name: "Sneakers Donna",
        discount: "-45%",
        products: [
          item("Nike Air Force White/Pink", "181,80", "99,99", "-45%", "sneakers"),
          item("Gucci High Top GG Supreme Beige/Green/Red", "254,53", "139,99", "-45%", "sneakers"),
          item("Louis Vuitton Trainer White/Pink", "272,71", "149,99", "-45%", "sneakers"),
          item("Balenciaga Track Black/Pink", "309,07", "169,99", "-45%", "sneakers"),
          item("Alexander McQueen Grey/White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Sky Blue", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic", "272,71", "149,99", "-45%", "sneakers"),
        ],
      },
    ],
  },
];

function slugifyProduct(value) {
  return String(value || "prodotto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "prodotto";
}

function assignCatalogProductIds() {
  const counters = {};
  catalogSections.forEach((section) => {
    section.categories.forEach((category) => {
      category.products.forEach((product) => {
        const slug = slugifyProduct(product.name);
        counters[slug] = (counters[slug] || 0) + 1;
        product.id = counters[slug] === 1 ? slug : `${slug}-${counters[slug]}`;
        product.baseName = product.name;
        product.collection = section.title;
        product.category = category.name;
      });
    });
  });
}

assignCatalogProductIds();

function showSlide(index) {
  if (slides.length === 0) {
    return;
  }
  slides[active].classList.remove("is-active");
  active = index;
  slides[active].classList.add("is-active");
  if (heroSlider) {
    heroSlider.classList.toggle("is-woman-active", slides[active].classList.contains("hero-slide-woman"));
  }
}

function getSizes(sizeType) {
  if (sizeType === "clothing") {
    return clothingSizes;
  }
  if (sizeType === "sneakers") {
    return sneakerSizes;
  }
  return [];
}

function createSizesMarkup(product) {
  const sizes = getSizes(product.sizeType);

  if (sizes.length === 0) {
    return "";
  }

  return `
    <div class="product-sizes" aria-label="Taglie disponibili">
      <span>Taglie</span>
      <div>${sizes.map((size) => `<button type="button">${size}</button>`).join("")}</div>
    </div>
  `;
}

const productImageVersion = "tryon-ai-products-1";
const productImageGalleries = {
  "Louis Vuitton Skate Beige/White": [
    "assets/products/louis-vuitton-skate-beige-white-1.png",
    "assets/products/louis-vuitton-skate-beige-white-2.png",
  ],
  "Nike Air Force Louis Vuitton Red": [
    "assets/products/nike-air-force-louis-vuitton-red-1.png",
    "assets/products/nike-air-force-louis-vuitton-red-2.png",
  ],
  "Polo Gucci": ["assets/products/polo-gucci-1.png"],
};

function withProductImageVersion(src) {
  const value = String(src || "");
  if (!value || value.startsWith("data:")) return value;
  return `${value}${value.includes("?") ? "&" : "?"}v=${productImageVersion}`;
}

function normalizeProductPrice(value) {
  return String(value || "").includes("€") ? String(value) : euro(value);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function normalizeOptionalProductPrice(value) {
  return String(value || "").trim() ? normalizeProductPrice(value) : "";
}

function applyProductOverride(product) {
  const override = productOverrides[product.id] || {};
  return {
    ...product,
    ...override,
    id: product.id,
    baseName: product.baseName || product.name,
    original: normalizeProductPrice(override.original || product.original),
    finalPrice: normalizeProductPrice(override.finalPrice || product.finalPrice),
    discount: override.discount || product.discount,
    sizeType: override.sizeType || product.sizeType,
    images: Array.isArray(override.images) ? override.images : product.images || [],
  };
}

function normalizeCustomProduct(product) {
  const sizeType = ["clothing", "sneakers", "none"].includes(product.sizeType) ? product.sizeType : "none";
  return {
    id: product.id || slugifyProduct(product.name),
    custom: true,
    baseName: product.baseName || product.name,
    name: product.name || "Prodotto",
    description: product.description || "",
    collection: product.collection || "Selezione Haller Boutique",
    category: product.category || "Nuovi arrivi",
    original: normalizeOptionalProductPrice(product.original),
    finalPrice: normalizeOptionalProductPrice(product.finalPrice),
    discount: product.discount || "",
    sizeType,
    images: Array.isArray(product.images) ? product.images : [],
  };
}

async function loadProductOverrides() {
  try {
    const response = await fetch("/api/products", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    productOverrides = data.items && typeof data.items === "object" ? data.items : {};
    customProducts = Array.isArray(data.custom) ? data.custom.map(normalizeCustomProduct) : [];
    renderCatalog();
  } catch {
    productOverrides = {};
    customProducts = [];
  }
}

function createProductMediaMarkup(product) {
  const gallery = product.images?.length
    ? product.images
    : productImageGalleries[product.baseName] || productImageGalleries[product.name] || [];

  if (gallery.length === 0) {
    return `
      <div class="image-placeholder">
        <span>Placeholder immagine</span>
      </div>
    `;
  }

  return `
    <img
      class="product-image"
      src="${withProductImageVersion(gallery[0])}"
      alt="${escapeHtml(product.name)}"
      loading="lazy"
      decoding="async"
    >
  `;
}

function productPrimaryImage(product) {
  const gallery = product.images?.length
    ? product.images
    : productImageGalleries[product.baseName] || productImageGalleries[product.name] || [];
  return gallery[0] || "";
}

function createTryOnMarkup(product) {
  if (product.sizeType !== "clothing") return "";
  return `<button class="tryon-action" type="button" data-try-on="${escapeHtml(product.id)}">Indossa</button>`;
}

function createProductCard(product) {
  return `
    <article class="product-card">
      <div class="product-media">
        <span class="discount-badge">${escapeHtml(product.discount)}</span>
        ${createProductMediaMarkup(product)}
      </div>
      <div class="product-body">
        <h4>${escapeHtml(product.name)}</h4>
        <div class="product-prices" aria-label="Prezzo">
          <span class="price-original">${escapeHtml(product.original)}</span>
          <strong>${escapeHtml(product.finalPrice)}</strong>
        </div>
        ${createSizesMarkup(product)}
        <div class="product-actions">
          <button class="cart-action" type="button" data-add-to-cart="${escapeHtml(product.name)}">Aggiungi al carrello</button>
          <button class="buy-action" type="button" data-buy-now="${escapeHtml(product.name)}">Acquista ora</button>
          ${createTryOnMarkup(product)}
        </div>
      </div>
    </article>
  `;
}

function getAllProducts() {
  const defaults = catalogSections
    .flatMap((section) => section.categories.flatMap((category) => category.products))
    .map(applyProductOverride);
  return [...customProducts, ...defaults];
}

const homeFeaturedProductNames = [
  "Nike Air Force Louis Vuitton Red",
  "Louis Vuitton Skate Beige/White",
  "T-Shirt Balenciaga",
  "Polo Gucci",
  "Tracksuit Nike Nocta",
  "Jacket Stone Island",
  "Crossbody Bag Louis Vuitton",
  "Bag Louis Vuitton",
  "Nike Air Force White/Pink",
];

function getHomeFeaturedProducts() {
  const allProducts = getAllProducts();
  const defaultFeatured = homeFeaturedProductNames
    .map((productName) => allProducts.find((product) => product.baseName === productName || product.name === productName))
    .filter(Boolean);
  return [...customProducts, ...defaultFeatured]
    .slice(0, 9);
}

function findProduct(productName) {
  return getAllProducts().find((product) => product.name === productName);
}

function findProductById(productId) {
  return getAllProducts().find((product) => product.id === productId);
}

function saveCheckoutItem(productName) {
  const product = findProduct(productName);

  if (!product) {
    return null;
  }

  const item = {
    name: product.name,
    price: product.finalPrice,
    original: product.original,
    savedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(checkoutItemKey, JSON.stringify(item));
  return item;
}

function renderCatalog() {
  const catalogRoot = document.querySelector("[data-catalog]");

  if (!catalogRoot) {
    return;
  }

  catalogRoot.innerHTML = `
    <section class="catalog-featured">
      <div class="product-grid product-grid-featured">
        ${getHomeFeaturedProducts().map(createProductCard).join("")}
      </div>
    </section>
  `;
  refreshScrollReveals(catalogRoot);
}

function refreshScrollReveals(root = document) {
  if (!siteMotionEnabled) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isProduct = entry.target.classList.contains("product-card");
          if (isProduct) {
            if (!entry.isIntersecting) return;
            entry.target.dataset.scrollDirection = motionScrollDirection;
            entry.target.classList.remove("is-revealed");
            window.requestAnimationFrame(() => {
              entry.target.classList.add("is-revealed");
              updateProductScrollMotion();
            });
            return;
          }
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -44px" }
    );
  }

  const selector = ".benefits, .location-delivery-banner, .catalog-intro, .product-card, .site-footer > section";
  root.querySelectorAll(selector).forEach((element, index) => {
    if (element.hasAttribute("data-reveal")) return;
    element.dataset.reveal = "";
    element.style.setProperty("--reveal-delay", `${Math.min((index % 3) * 80, 160)}ms`);
    revealObserver.observe(element);
  });
}

function createClickRipple(event) {
  if (!siteMotionEnabled) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = event.target.closest("button, a");
  if (!target || target.closest(".language-menu")) return;

  const bounds = target.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return;
  const ripple = document.createElement("span");
  ripple.className = "click-ripple";
  ripple.style.left = `${event.clientX - bounds.left}px`;
  ripple.style.top = `${event.clientY - bounds.top}px`;
  target.classList.add("is-ripple-target");
  target.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

function bumpCart() {
  if (!siteMotionEnabled) return;
  document.querySelectorAll(".cart-button").forEach((cart) => {
    cart.classList.remove("is-bumped");
    void cart.offsetWidth;
    cart.classList.add("is-bumped");
  });
}

function updateScrollMotion() {
  motionScrollFrame = 0;
  if (!siteMotionEnabled) return;
  const progress = document.querySelector(".scroll-progress");
  if (!progress) return;
  const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  progress.style.setProperty("--scroll-progress", `${(window.scrollY / maxScroll) * 100}%`);
  updateProductScrollMotion();
}

function updateProductScrollMotion() {
  const viewportCenter = window.innerHeight / 2;
  document.querySelectorAll(".product-card.is-revealed").forEach((card) => {
    const bounds = card.getBoundingClientRect();
    const distance = Math.max(-1, Math.min(1, (viewportCenter - (bounds.top + bounds.height / 2)) / window.innerHeight));
    card.style.setProperty("--product-scroll-y", `${(distance * 10).toFixed(2)}px`);
    card.style.setProperty("--product-scroll-tilt", `${(distance * -1.15).toFixed(2)}deg`);
    card.style.setProperty("--product-image-y", `${(distance * -9).toFixed(2)}px`);
  });
}

function setupSiteMotion() {
  if (!siteMotionEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  if (!document.querySelector(".scroll-progress")) {
    const progress = document.createElement("div");
    progress.className = "scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    document.body.prepend(progress);
  }

  if (!motionEventsBound) {
    window.addEventListener(
      "scroll",
      () => {
        const nextScrollY = window.scrollY;
        if (Math.abs(nextScrollY - lastMotionScrollY) > 2) {
          motionScrollDirection = nextScrollY > lastMotionScrollY ? "down" : "up";
          lastMotionScrollY = nextScrollY;
        }
        if (siteMotionEnabled && !motionScrollFrame) motionScrollFrame = window.requestAnimationFrame(updateScrollMotion);
      },
      { passive: true }
    );

    if (heroSlider && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      heroSlider.addEventListener("pointermove", (event) => {
        if (!siteMotionEnabled) return;
        const bounds = heroSlider.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * -10;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * -8;
        heroSlider.style.setProperty("--hero-x", `${x.toFixed(2)}px`);
        heroSlider.style.setProperty("--hero-y", `${y.toFixed(2)}px`);
      });
      heroSlider.addEventListener("pointerleave", () => {
        heroSlider.style.setProperty("--hero-x", "0px");
        heroSlider.style.setProperty("--hero-y", "0px");
      });
    }

    document.addEventListener("pointerdown", createClickRipple);
    motionEventsBound = true;
  }

  updateScrollMotion();
  refreshScrollReveals();
}

function setSiteMotion(enabled, flickerLogo = false) {
  siteMotionEnabled = Boolean(enabled) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.body.classList.toggle("motion-enabled", siteMotionEnabled);
  const logo = document.querySelector(".site-header .logo img");
  logo?.classList.remove("is-powering-on");
  if (siteMotionEnabled && flickerLogo && logo) {
    void logo.offsetWidth;
    logo.classList.add("is-powering-on");
    logo.addEventListener("animationend", () => logo.classList.remove("is-powering-on"), { once: true });
  }

  if (siteMotionEnabled) {
    setupSiteMotion();
    return;
  }

  document.querySelector(".scroll-progress")?.remove();
  heroSlider?.style.setProperty("--hero-x", "0px");
  heroSlider?.style.setProperty("--hero-y", "0px");
  document.querySelectorAll("[data-reveal]").forEach((element) => {
    element.classList.add("is-revealed");
    element.style.removeProperty("--product-scroll-y");
    element.style.removeProperty("--product-scroll-tilt");
    element.style.removeProperty("--product-image-y");
  });
}

function readCartCount() {
  const cartItems = readCartItems();
  if (cartItems.length > 0) {
    return cartItems.length;
  }

  const count = Number.parseInt(window.localStorage.getItem(cartKey), 10);
  return Number.isFinite(count) ? count : 0;
}

function readCartItems() {
  try {
    const items = JSON.parse(window.localStorage.getItem(cartItemsKey));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function addCheckoutItem(productName) {
  const item = saveCheckoutItem(productName);

  if (!item) {
    return readCartItems();
  }

  const cartItems = readCartItems();
  cartItems.push(item);
  window.localStorage.setItem(cartItemsKey, JSON.stringify(cartItems));

  return cartItems;
}

function updateCartCount(count = readCartCount()) {
  document.querySelectorAll(".cart-button span").forEach((badge) => {
    badge.textContent = String(count);
  });
}

function addToCart(button) {
  const productName = button ? button.dataset.addToCart || button.dataset.buyNow : "";
  const cartItems = productName ? addCheckoutItem(productName) : [];
  const count = cartItems.length > 0 ? cartItems.length : readCartCount() + 1;
  window.localStorage.setItem(cartKey, String(count));
  updateCartCount(count);
  bumpCart();

  if (productName) {
    sendTrack(button && button.dataset.buyNow ? "buy_now" : "add_to_cart", { product: productName });
    recordReplay(button && button.dataset.buyNow ? "checkout" : "click", {
      target: button && button.dataset.buyNow ? "Acquista ora" : "Aggiungi al carrello",
      text: productName,
      depth: currentScrollDepth(),
    });
  }

  if (!button) {
    return;
  }

  const originalText = button.textContent;
  button.textContent = "Aggiunto";
  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1200);
}

function ensureTryOnModal() {
  let modal = document.querySelector("[data-tryon-modal]");
  if (modal) return modal;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="tryon-modal" data-tryon-modal hidden>
        <div class="tryon-backdrop" data-tryon-close></div>
        <section class="tryon-dialog" role="dialog" aria-modal="true" aria-labelledby="tryon-title">
          <button class="tryon-close" type="button" data-tryon-close aria-label="Chiudi try-on">
            <i data-lucide="x"></i>
          </button>
          <div class="tryon-heading">
            <p>Try-on AI</p>
            <h2 id="tryon-title" data-tryon-title>Prova il prodotto</h2>
            <span>Carica una tua foto frontale. La foto serve solo per generare l'anteprima e non viene salvata nel catalogo.</span>
          </div>
          <div class="tryon-layout">
            <label class="tryon-upload">
              <input type="file" accept="image/png,image/jpeg,image/webp" data-tryon-user-image>
              <i data-lucide="upload-cloud"></i>
              <strong>Carica foto</strong>
              <span>JPG, PNG o WebP</span>
            </label>
            <div class="tryon-result" data-tryon-result>
              <p>Il risultato comparira qui.</p>
            </div>
          </div>
          <button class="tryon-generate" type="button" data-tryon-generate>Genera prova AI</button>
          <div class="ai-progress" data-tryon-progress hidden>
            <div class="ai-progress-track" role="progressbar" aria-label="Avanzamento try-on AI" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <i data-tryon-progress-bar></i>
            </div>
            <span data-tryon-progress-label></span>
          </div>
          <p class="tryon-message" data-tryon-message aria-live="polite"></p>
        </section>
      </div>
    `
  );

  modal = document.querySelector("[data-tryon-modal]");
  modal.querySelectorAll("[data-tryon-close]").forEach((button) => {
    button.addEventListener("click", closeTryOnModal);
  });
  modal.querySelector("[data-tryon-user-image]")?.addEventListener("change", previewTryOnUserImage);
  modal.querySelector("[data-tryon-generate]")?.addEventListener("click", generateTryOn);
  if (window.lucide) window.lucide.createIcons();
  return modal;
}

function setTryOnMessage(message, type = "") {
  const messageRoot = document.querySelector("[data-tryon-message]");
  if (!messageRoot) return;
  messageRoot.textContent = message || "";
  messageRoot.dataset.type = type;
}

function setTryOnProgress(progress, message = "", type = "") {
  const root = document.querySelector("[data-tryon-progress]");
  const bar = document.querySelector("[data-tryon-progress-bar]");
  const label = document.querySelector("[data-tryon-progress-label]");
  if (!root || !bar || !label) return;
  const value = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  root.hidden = false;
  root.dataset.type = type;
  bar.style.setProperty("--ai-progress", `${value}%`);
  bar.parentElement?.setAttribute("aria-valuenow", String(value));
  label.textContent = message;
}

function resetTryOnProgress() {
  const root = document.querySelector("[data-tryon-progress]");
  const bar = document.querySelector("[data-tryon-progress-bar]");
  const label = document.querySelector("[data-tryon-progress-label]");
  if (!root || !bar || !label) return;
  root.hidden = true;
  root.dataset.type = "";
  bar.style.setProperty("--ai-progress", "0%");
  bar.parentElement?.setAttribute("aria-valuenow", "0");
  label.textContent = "";
}

async function uploadWithProgress(path, body, onProgress) {
  const response = await fetch(path, { method: "POST", body });
  const reader = response.body?.getReader();
  if (!reader) {
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.message || "Operazione AI non riuscita.");
    return data;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let finalEvent = null;
  const consume = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "progress") {
      onProgress?.(event);
      return;
    }
    finalEvent = event;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach(consume);
    if (done) break;
  }
  consume(buffer);

  if (!finalEvent) throw new Error("Risposta AI non ricevuta.");
  if (finalEvent.type === "error") throw new Error(finalEvent.message || "Operazione AI non riuscita.");
  const data = finalEvent.data || finalEvent;
  if (!response.ok || data.ok === false) throw new Error(data.message || "Operazione AI non riuscita.");
  return data;
}

function setTryOnResult(content) {
  const result = document.querySelector("[data-tryon-result]");
  if (result) result.innerHTML = content;
}

function closeTryOnModal() {
  const modal = document.querySelector("[data-tryon-modal]");
  if (!modal) return;
  modal.hidden = true;
  modal.classList.remove("is-open");
  resetTryOnProgress();
  tryOnProduct = null;
  if (tryOnPreviewUrl) URL.revokeObjectURL(tryOnPreviewUrl);
  tryOnPreviewUrl = "";
}

function openTryOnModal(productId) {
  const product = findProductById(productId);
  if (!product) return;
  tryOnProduct = product;
  const modal = ensureTryOnModal();
  modal.hidden = false;
  modal.classList.add("is-open");
  const title = modal.querySelector("[data-tryon-title]");
  if (title) title.textContent = `Prova ${product.name}`;
  const input = modal.querySelector("[data-tryon-user-image]");
  if (input) input.value = "";
  setTryOnMessage("");
  resetTryOnProgress();
  setTryOnResult("<p>Carica una tua foto per vedere l'anteprima.</p>");
}

function previewTryOnUserImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (tryOnPreviewUrl) URL.revokeObjectURL(tryOnPreviewUrl);
  tryOnPreviewUrl = URL.createObjectURL(file);
  setTryOnResult(`
    <img src="${tryOnPreviewUrl}" alt="Foto caricata per try-on">
    <span>Foto caricata. Premi Genera prova AI.</span>
  `);
  setTryOnMessage("");
}

function loadTryOnReferenceImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Immagine del prodotto non disponibile."));
    image.src = src;
  });
}

function drawTryOnReferenceImage(context, image, x, y, width, height, background) {
  context.fillStyle = background;
  context.fillRect(x, y, width, height);
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function createTryOnReference(userFile, productImage) {
  const customerUrl = URL.createObjectURL(userFile);
  try {
    const [customer, product] = await Promise.all([
      loadTryOnReferenceImage(customerUrl),
      loadTryOnReferenceImage(productImage),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = 1536;
    canvas.height = 1086;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Preparazione immagine non disponibile.");

    context.fillStyle = "#111111";
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawTryOnReferenceImage(context, customer, 0, 62, 1000, 1024, "#151515");
    drawTryOnReferenceImage(context, product, 1000, 62, 536, 1024, "#ffffff");
    context.fillStyle = "#ffffff";
    context.font = "600 25px Montserrat, Arial, sans-serif";
    context.fillText("PERSONA", 24, 40);
    context.fillText("CAPO REALE DEL CATALOGO", 1040, 40);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Preparazione immagine non riuscita."))), "image/png");
    });
    return blob;
  } finally {
    URL.revokeObjectURL(customerUrl);
  }
}

async function generateTryOn() {
  const modal = ensureTryOnModal();
  const input = modal.querySelector("[data-tryon-user-image]");
  const file = input?.files?.[0];
  const button = modal.querySelector("[data-tryon-generate]");
  if (!tryOnProduct) return;
  if (!file) {
    setTryOnMessage("Carica prima una tua foto.", "error");
    return;
  }

  button.disabled = true;
  setTryOnProgress(4, "Preparazione del capo reale");
  setTryOnMessage("Preparazione del capo reale...");
  setTryOnResult("<p>Sto preparando l'anteprima AI...</p>");

  try {
    const referenceImage = await createTryOnReference(file, productPrimaryImage(tryOnProduct));
    const formData = new FormData();
    formData.append("userImage", referenceImage, "try-on-reference.png");
    formData.append("productId", tryOnProduct.id || "");
    formData.append("productName", tryOnProduct.name || "");
    formData.append("category", tryOnProduct.category || "");
    setTryOnProgress(16, "Foto cliente e capo del catalogo pronti");
    setTryOnMessage("Invio foto al server...");
    const data = await uploadWithProgress("/api/try-on?progress=1", formData, (event) => {
      setTryOnProgress(event.progress, event.message);
      setTryOnMessage(event.message);
    });
    setTryOnProgress(100, "Anteprima pronta", "success");
    setTryOnResult(`<img src="${escapeHtml(data.image)}" alt="Anteprima try-on AI">`);
    setTryOnMessage("Anteprima pronta.", "success");
    sendTrack("try_on_generated", { product: tryOnProduct.name });
  } catch (error) {
    setTryOnProgress(100, "Generazione non riuscita", "error");
    setTryOnResult("<p>Non siamo riusciti a generare l'anteprima.</p>");
    setTryOnMessage(error.message || "Try-on non disponibile.", "error");
  } finally {
    button.disabled = false;
  }
}

function createOrderCode() {
  const now = new Date();
  const date = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const random =
    window.crypto && window.crypto.getRandomValues
      ? Array.from(window.crypto.getRandomValues(new Uint8Array(3)))
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
      : Math.random().toString(16).slice(2, 8).toUpperCase();

  return `HB-${date}-${random}`;
}

function readOrderCode() {
  let orderCode = window.localStorage.getItem(orderCodeKey);

  if (!orderCode) {
    orderCode = createOrderCode();
    window.localStorage.setItem(orderCodeKey, orderCode);
  }

  return orderCode;
}

function readCheckoutItem() {
  try {
    return JSON.parse(window.localStorage.getItem(checkoutItemKey));
  } catch {
    return null;
  }
}

function getCheckoutProductText() {
  const cartItems = readCartItems();

  if (cartItems.length > 0) {
    return cartItems.map((item) => `${item.name} - ${item.price}`).join("; ");
  }

  const item = readCheckoutItem();

  if (!item || !item.name) {
    return "Da confermare";
  }

  return item.price ? `${item.name} - ${item.price}` : item.name;
}

function getFieldValue(name) {
  const field = document.querySelector(`[name="${name}"]`);
  return field && field.value.trim() ? field.value.trim() : "Da compilare";
}

function copyText(text, button) {
  if (!text) {
    return;
  }

  const setCopied = () => {
    if (!button) {
      return;
    }
    const label = button.querySelector("span") || button;
    const originalText = label.textContent;
    label.textContent = "Copiato";
    window.setTimeout(() => {
      label.textContent = originalText;
    }, 1200);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(setCopied).catch(() => {});
    return;
  }

  window.prompt("Copia questo testo", text);
  setCopied();
}

function buildPaymentPacket(orderCode, wallet) {
  return [
    `Codice ordine: ${orderCode}`,
    `Prodotto: ${getCheckoutProductText()}`,
    `Cliente: ${getFieldValue("name")}`,
    `Telefono: ${getFieldValue("phone")}`,
    `Email: ${getFieldValue("email")}`,
    `Pagamento: ${wallet.title} (${wallet.network})`,
    `Wallet: ${wallet.address || wallet.displayAddress}`,
    `TX hash: ${getFieldValue("tx-hash")}`,
  ].join("\n");
}

function setupCheckoutPayments() {
  const cryptoPanel = document.querySelector(".crypto-payment");
  const codPanel = document.querySelector(".cod-only");
  const paymentInputs = Array.from(document.querySelectorAll('input[name="payment-method"]'));
  const paymentOptions = Array.from(document.querySelectorAll(".payment-option"));
  const paymentSummary = document.querySelector("[data-payment-method-summary]");
  const checkoutNote = document.querySelector("[data-checkout-note]");
  const orderCode = readOrderCode();
  const orderProduct = document.querySelector("[data-order-product]");
  const qrImage = document.querySelector("[data-crypto-qr]");
  const walletCard = document.querySelector(".crypto-wallet-card");
  const cryptoTitle = document.querySelector("[data-crypto-title]");
  const cryptoNetwork = document.querySelector("[data-crypto-network]");
  const cryptoAddress = document.querySelector("[data-crypto-address]");
  const cryptoWarning = document.querySelector("[data-crypto-warning]");
  const paymentPacket = document.querySelector("[data-payment-packet]");
  const cryptoButtons = Array.from(document.querySelectorAll("[data-crypto-option]"));
  const copyWalletButton = document.querySelector("[data-copy-wallet]");
  let selectedCrypto = "btc";

  if (paymentInputs.length === 0 && !cryptoPanel) {
    return;
  }

  if (orderProduct) {
    orderProduct.textContent = getCheckoutProductText();
  }

  document.querySelectorAll("[data-order-code]").forEach((element) => {
    element.textContent = orderCode;
  });

  function updatePaymentPacket() {
    const wallet = cryptoWallets[selectedCrypto];
    if (paymentPacket && wallet) {
      paymentPacket.value = buildPaymentPacket(orderCode, wallet);
    }
  }

  function setCryptoOption(option) {
    const wallet = cryptoWallets[option] || cryptoWallets.btc;
    selectedCrypto = option in cryptoWallets ? option : "btc";

    cryptoButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.cryptoOption === selectedCrypto);
    });

    if (cryptoTitle) {
      cryptoTitle.textContent = wallet.title;
    }
    if (cryptoNetwork) {
      cryptoNetwork.textContent = wallet.network;
    }
    if (cryptoAddress) {
      cryptoAddress.textContent = wallet.address || wallet.displayAddress;
    }
    if (qrImage) {
      if (wallet.address && wallet.qrData) {
        const qrData = wallet.qrData(orderCode);
        qrImage.hidden = false;
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(qrData)}`;
      } else {
        qrImage.hidden = true;
        qrImage.removeAttribute("src");
      }
    }
    if (walletCard) {
      walletCard.classList.toggle("is-missing-wallet", !wallet.address);
    }
    if (cryptoWarning) {
      cryptoWarning.hidden = !wallet.warning;
      cryptoWarning.textContent = wallet.warning || "";
    }
    if (copyWalletButton) {
      copyWalletButton.disabled = !wallet.address;
      const label = copyWalletButton.querySelector("span");
      if (label) {
        label.textContent = wallet.address ? "Copia indirizzo" : "Wallet mancante";
      }
    }

    updatePaymentPacket();
  }

  function setPaymentMethod(method) {
    const isCrypto = method === "crypto";

    paymentInputs.forEach((input) => {
      input.checked = input.value === method;
    });

    paymentOptions.forEach((option) => {
      const input = option.querySelector("input");
      option.classList.toggle("is-active", Boolean(input && input.value === method));
    });

    if (cryptoPanel) {
      cryptoPanel.hidden = !isCrypto;
    }
    if (codPanel) {
      codPanel.hidden = isCrypto;
    }
    if (paymentSummary) {
      paymentSummary.textContent = isCrypto ? `Crypto ${cryptoWallets[selectedCrypto].title}` : "Contrassegno";
    }
    if (checkoutNote) {
      checkoutNote.textContent = isCrypto
        ? "Invia pagamento crypto e poi manda TX hash con codice ordine."
        : "Nessun pagamento online richiesto in questa fase.";
    }

    updatePaymentPacket();
  }

  paymentInputs.forEach((input) => {
    input.addEventListener("change", () => setPaymentMethod(input.value));
  });

  cryptoButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setCryptoOption(button.dataset.cryptoOption);
      setPaymentMethod("crypto");
    });
  });

  document.querySelectorAll(".checkout-form input").forEach((input) => {
    input.addEventListener("input", updatePaymentPacket);
  });

  const copyOrderButton = document.querySelector("[data-copy-order-code]");
  if (copyOrderButton) {
    copyOrderButton.addEventListener("click", () => copyText(orderCode, copyOrderButton));
  }

  if (copyWalletButton) {
    copyWalletButton.addEventListener("click", () => {
      const wallet = cryptoWallets[selectedCrypto];
      if (!wallet.address) {
        return;
      }

      copyText(wallet.address, copyWalletButton);
    });
  }

  const copyPacketButton = document.querySelector("[data-copy-payment-packet]");
  if (copyPacketButton) {
    copyPacketButton.addEventListener("click", () => {
      copyText(paymentPacket ? paymentPacket.value : "", copyPacketButton);
    });
  }

  setCryptoOption(selectedCrypto);
  setPaymentMethod(paymentInputs.find((input) => input.checked)?.value || "cod");
}

function collectCheckoutProducts() {
  const cartItems = readCartItems();
  if (cartItems.length > 0) {
    return cartItems.map((item) => ({
      name: item.name,
      price: item.price,
      size: item.size || "",
      quantity: 1,
    }));
  }

  const item = readCheckoutItem();
  return item && item.name ? [{ name: item.name, price: item.price, size: item.size || "", quantity: 1 }] : [];
}

function checkoutField(name) {
  const field = document.querySelector(`[name="${name}"]`);
  return field ? field.value.trim() : "";
}

function selectedPaymentLabel() {
  const selected = document.querySelector('input[name="payment-method"]:checked');
  if (!selected || selected.value === "cod") return "Contrassegno";
  const selectedCrypto = document.querySelector("[data-crypto-option].is-active span:last-child");
  return selectedCrypto ? `Crypto ${selectedCrypto.textContent.trim()}` : "Crypto";
}

async function confirmCheckoutOrder(button) {
  if (!button) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Conferma in corso";
  const ids = trackingIds();

  const payload = {
    visitorId: ids.visitorId,
    sessionId: ids.sessionId,
    orderCode: readOrderCode(),
    customer: {
      name: checkoutField("name"),
      phone: checkoutField("phone"),
      email: checkoutField("email"),
      address: checkoutField("address"),
      city: checkoutField("city"),
      postalCode: checkoutField("postal-code"),
    },
    paymentMethod: selectedPaymentLabel(),
    txHash: checkoutField("tx-hash"),
    discountCode: checkoutField("discount-code"),
    products: collectCheckoutProducts(),
    deviceInfo: currentDeviceInfo(),
    preciseLocation: currentPreciseLocation(),
  };

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "Ordine non salvato.");

    sendTrack("order_confirmed", {
      method: payload.paymentMethod,
      product: payload.products.map((product) => product.name).join("; "),
    });
    recordReplay("order", {
      target: data.order.orderCode,
      text: payload.paymentMethod,
      depth: currentScrollDepth(),
    });
    flushReplay("order");

    window.localStorage.removeItem(cartItemsKey);
    window.localStorage.removeItem(cartKey);
    updateCartCount(0);

    const note = document.querySelector("[data-checkout-note]");
    if (note) {
      note.textContent = `Ordine ${data.order.orderCode} confermato. Totale ${data.order.total}.`;
    }
    button.textContent = "Ordine confermato";
  } catch (error) {
    const note = document.querySelector("[data-checkout-note]");
    if (note) {
      note.textContent = error.message || "Non siamo riusciti a salvare l'ordine.";
    }
    button.disabled = false;
    button.textContent = originalText;
  }
}

renderCatalog();
loadProductOverrides();
updateCartCount();
setupLocationDeliveryBanner();
setSiteMotion(true, true);

if (!isReplayView) {
  renderConsentManager();
  const existingConsent = readConsent();
  if (existingConsent?.analytics) {
    syncConsentServer(existingConsent).finally(startConsentedTracking);
  }
}

window.addEventListener("scroll", currentScrollDepth, { passive: true });
window.setInterval(() => {
  sendTrack("heartbeat");
}, 30000);

window.addEventListener("pagehide", () => {
  flushReplay("pagehide");
  sendTrack("page_exit");
});

if (window.lucide) {
  window.lucide.createIcons();
}

const languagePicker = document.querySelector("[data-language-picker]");
if (languagePicker) {
  const languageToggle = languagePicker.querySelector(".language-toggle");
  const languageMenu = languagePicker.querySelector(".language-menu");
  const languageOptions = [...languagePicker.querySelectorAll("[data-language-option]")];
  const languageLabels = Object.fromEntries(
    languageOptions.map((option) => [option.dataset.languageOption, option.getAttribute("aria-label")])
  );
  const savedLanguage = localStorage.getItem("haller-language") || "it";

  const applyLanguage = (language) => {
    const selectedLanguage = languageLabels[language] ? language : "it";
    document.documentElement.lang = selectedLanguage;
    languageOptions.forEach((option) => {
      option.setAttribute("aria-checked", String(option.dataset.languageOption === selectedLanguage));
    });
    languageToggle.setAttribute("aria-label", `Lingua: ${languageLabels[selectedLanguage]}`);
  };

  const closeLanguageMenu = () => {
    languageMenu.classList.remove("is-open");
    languageToggle.setAttribute("aria-expanded", "false");
  };

  applyLanguage(savedLanguage);
  languageToggle.addEventListener("click", () => {
    const isOpen = languageMenu.classList.toggle("is-open");
    languageToggle.setAttribute("aria-expanded", String(isOpen));
  });

  languageOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const language = option.dataset.languageOption;
      localStorage.setItem("haller-language", language);
      applyLanguage(language);
      closeLanguageMenu();
    });
  });

  document.addEventListener("click", (event) => {
    if (!languagePicker.contains(event.target)) closeLanguageMenu();
  });
}

if (slides.length > 0) {
  window.setInterval(() => {
    showSlide((active + 1) % slides.length);
  }, 5200);
}

document.addEventListener("click", (event) => {
  const tryOnButton = event.target.closest("[data-try-on]");
  const addButton = event.target.closest("[data-add-to-cart]");
  const buyButton = event.target.closest("[data-buy-now]");

  if (tryOnButton) {
    openTryOnModal(tryOnButton.dataset.tryOn);
  }

  if (addButton) {
    addToCart(addButton);
  }

  if (buyButton) {
    addToCart(buyButton);
    window.location.href = "checkout.html";
  }
});

const checkoutSubmitButton = document.querySelector(".checkout-submit");
if (checkoutSubmitButton) {
  checkoutSubmitButton.addEventListener("click", () => confirmCheckoutOrder(checkoutSubmitButton));
}

const discountButton = document.querySelector("[data-discount-apply]");
const discountInput = document.querySelector("input[name='discount-code']");
const discountMessage = document.querySelector(".discount-message");

if (discountButton && discountInput && discountMessage) {
  discountButton.addEventListener("click", () => {
    const code = discountInput.value.trim();

    discountMessage.textContent = code
      ? "Codice sconto inserito. Lo verificheremo alla conferma dell'ordine."
      : "Inserisci un codice sconto prima di applicarlo.";
  });
}

setupCheckoutPayments();

const chatProfileKey = "hallerBoutiqueChatProfile";
let chatHistory = [];

function readChatProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem(chatProfileKey));
    return profile && typeof profile === "object" ? profile : null;
  } catch {
    return null;
  }
}

function getChatCatalog() {
  return getAllProducts().map((product) => ({
    name: product.name,
    category: product.category,
    collection: product.collection,
    description: product.description,
    finalPrice: product.finalPrice,
    sizes: getSizes(product.sizeType),
  }));
}

function appendChatMessage(messages, role, text) {
  messages.insertAdjacentHTML("beforeend", `<p class="site-chat-message site-chat-message-${role}">${escapeHtml(text)}</p>`);
  messages.scrollTop = messages.scrollHeight;
}

function setupSiteChat() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <section class="site-chat" data-site-chat aria-label="Assistente virtuale Haller Boutique">
        <button class="site-chat-launcher" type="button" data-chat-toggle aria-expanded="false" aria-controls="site-chat-panel" aria-label="Apri assistente virtuale">
          <img src="assets/chat-assistant-avatar.png" alt="Aurora online" draggable="false">
          <span class="site-chat-online-copy"><strong>Aurora</strong><small>Online</small></span>
          <i class="site-chat-online-dot" aria-hidden="true"></i>
        </button>
        <div class="site-chat-panel" id="site-chat-panel" data-chat-panel hidden>
          <header class="site-chat-header">
            <img src="assets/chat-assistant-avatar.png" alt="Ritratto di Aurora, assistente virtuale" draggable="false">
            <div><strong>Aurora</strong><span>Assistente online</span></div>
            <button type="button" data-chat-toggle aria-label="Chiudi assistente virtuale"><i data-lucide="x"></i></button>
          </header>
          <form class="site-chat-profile" data-chat-profile>
            <p>Prima di iniziare, lasciami i tuoi dati per seguirti meglio.</p>
            <div class="site-chat-profile-grid">
              <label>Nome<input name="firstName" autocomplete="given-name" required></label>
              <label>Cognome<input name="lastName" autocomplete="family-name" required></label>
            </div>
            <label>Email<input name="email" type="email" autocomplete="email" required></label>
            <label>Cellulare <em>facoltativo</em><input name="phone" type="tel" autocomplete="tel"></label>
            <small>I dati vengono usati solo per offrirti assistenza in questa conversazione.</small>
            <button type="submit">Inizia la chat</button>
          </form>
          <div class="site-chat-conversation" data-chat-conversation hidden>
            <div class="site-chat-messages" data-chat-messages aria-live="polite"></div>
            <div class="site-chat-actions">
              <button type="button" data-chat-prompt="Mi aiuti a scegliere la taglia?">Taglie</button>
              <button type="button" data-chat-prompt="Vorrei sapere dove si trova il mio ordine. Il mio codice e HB-">Segui ordine</button>
            </div>
            <form class="site-chat-composer" data-chat-composer>
              <input data-chat-input maxlength="900" placeholder="Scrivi qui..." autocomplete="off" required>
              <button type="submit" aria-label="Invia messaggio"><i data-lucide="send"></i></button>
            </form>
          </div>
        </div>
      </section>
    `
  );

  const root = document.querySelector("[data-site-chat]");
  const panel = root.querySelector("[data-chat-panel]");
  const profileForm = root.querySelector("[data-chat-profile]");
  const conversation = root.querySelector("[data-chat-conversation]");
  const messages = root.querySelector("[data-chat-messages]");
  const composer = root.querySelector("[data-chat-composer]");
  const input = root.querySelector("[data-chat-input]");
  let profile = readChatProfile();

  const showConversation = () => {
    profileForm.hidden = true;
    conversation.hidden = false;
    if (!messages.children.length) appendChatMessage(messages, "assistant", `Ciao ${profile.firstName}, sono Aurora, l'assistente virtuale di Haller Boutique. Come posso aiutarti?`);
  };

  const openChat = () => {
    panel.hidden = false;
    root.querySelector(".site-chat-launcher").setAttribute("aria-expanded", "true");
    if (profile) showConversation();
  };

  root.querySelectorAll("[data-chat-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const isOpen = panel.hidden;
      if (isOpen) openChat();
      else {
        panel.hidden = true;
        root.querySelector(".site-chat-launcher").setAttribute("aria-expanded", "false");
      }
    });
  });

  if (profile) {
    ["firstName", "lastName", "email", "phone"].forEach((name) => {
      const field = profileForm.elements.namedItem(name);
      if (field) field.value = profile[name] || "";
    });
  }

  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(profileForm));
    profile = {
      firstName: String(values.firstName || "").trim(),
      lastName: String(values.lastName || "").trim(),
      email: String(values.email || "").trim(),
      phone: String(values.phone || "").trim(),
    };
    localStorage.setItem(chatProfileKey, JSON.stringify(profile));
    showConversation();
    input.focus();
  });

  const sendMessage = async (message) => {
    const text = String(message || "").trim();
    if (!text || !profile) return;
    appendChatMessage(messages, "user", text);
    chatHistory.push({ role: "user", content: text });
    input.value = "";
    input.disabled = true;
    appendChatMessage(messages, "assistant", "Un attimo, controllo.");
    const pending = messages.lastElementChild;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, message: text, history: chatHistory.slice(0, -1), catalog: getChatCatalog() }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "Non riesco a rispondere ora.");
      pending.textContent = data.reply;
      chatHistory.push({ role: "assistant", content: data.reply });
    } catch (error) {
      pending.textContent = error.message || "Non riesco a rispondere ora.";
    } finally {
      input.disabled = false;
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }
  };

  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });
  root.querySelectorAll("[data-chat-prompt]").forEach((button) => button.addEventListener("click", () => sendMessage(button.dataset.chatPrompt)));
  document.querySelectorAll("[data-open-chat]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    openChat();
  }));
  if (new URLSearchParams(window.location.search).get("chat") === "1") openChat();
  if (window.lucide) window.lucide.createIcons();
}

setupSiteChat();
