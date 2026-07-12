const slides = Array.from(document.querySelectorAll(".hero-slide"));
let active = 0;

const clothingSizes = ["S", "M", "L", "XL", "XXL"];
const sneakerSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
const cartKey = "hallerBoutiqueCartCount";
const cartItemsKey = "hallerBoutiqueCartItems";
const checkoutItemKey = "hallerBoutiqueCheckoutItem";
const orderCodeKey = "hallerBoutiqueOrderCode";
const visitorIdKey = "hallerBoutiqueVisitorId";
const serverVisitorIdKey = "hallerBoutiqueServerVisitorId";
const analyticsSessionKey = "hallerBoutiqueSessionId";
const analyticsSessionStartedKey = "hallerBoutiqueSessionStartedAt";
const consentKey = "hallerBoutiqueConsent";
const consentVersion = 1;
const isReplayView = new URLSearchParams(window.location.search).get("replay_view") === "1";

function randomId(prefix) {
  const bytes =
    window.crypto && window.crypto.getRandomValues
      ? Array.from(window.crypto.getRandomValues(new Uint8Array(10)))
      : Array.from({ length: 10 }, () => Math.floor(Math.random() * 256));
  return `${prefix}_${bytes.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function readConsent() {
  try {
    const consent = JSON.parse(window.localStorage.getItem(consentKey));
    return consent && consent.version === consentVersion
      ? { analytics: Boolean(consent.analytics), replay: Boolean(consent.replay), choice: consent.choice || "custom" }
      : null;
  } catch {
    return null;
  }
}

function saveConsent(consent) {
  const nextConsent = {
    version: consentVersion,
    analytics: Boolean(consent.analytics || consent.replay),
    replay: Boolean(consent.replay),
    choice: consent.choice || "custom",
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(consentKey, JSON.stringify(nextConsent));
  if (!nextConsent.replay) {
    analyticsState.replayBuffer = [];
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
};

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

function startConsentedTracking() {
  if (!hasAnalyticsConsent()) return;
  initAnalyticsState();
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
  return `
    <section class="cookie-banner" data-cookie-banner aria-label="Preferenze cookie">
      <div class="cookie-copy">
        <span>Privacy Haller Boutique</span>
        <h2>Cookie e registrazione sessione</h2>
        <p>Usiamo cookie tecnici per far funzionare il sito. Con il tuo consenso possiamo raccogliere metriche e replay sessione per capire visite, checkout abbandonati e problemi di navigazione. Password, pagamenti e valori dei campi non vengono registrati.</p>
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
  document.querySelector("[data-cookie-manage]")?.remove();
  const consent = readConsent();

  if (consent && !forceBanner) {
    const manage = document.createElement("button");
    manage.type = "button";
    manage.className = "cookie-manage";
    manage.dataset.cookieManage = "";
    manage.textContent = "Cookie";
    manage.addEventListener("click", () => renderConsentManager(true));
    document.body.appendChild(manage);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = consentBannerMarkup(consent);
  const banner = wrapper.firstElementChild;
  document.body.appendChild(banner);

  const options = banner.querySelector("[data-cookie-options]");
  const analyticsToggle = banner.querySelector("[data-consent-analytics]");
  const replayToggle = banner.querySelector("[data-consent-replay]");
  const saveButton = banner.querySelector("[data-consent-save]");
  const customButton = banner.querySelector("[data-consent-custom]");

  function closeWith(nextConsent) {
    saveConsent(nextConsent);
    banner.remove();
  }

  banner.querySelector("[data-consent-reject]")?.addEventListener("click", () => {
    closeWith({ analytics: false, replay: false, choice: "necessary" });
  });

  banner.querySelector("[data-consent-metrics]")?.addEventListener("click", () => {
    closeWith({ analytics: true, replay: false, choice: "analytics" });
  });

  banner.querySelector("[data-consent-accept]")?.addEventListener("click", () => {
    closeWith({ analytics: true, replay: true, choice: "all" });
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
  });

  saveButton?.addEventListener("click", () => {
    closeWith({
      analytics: analyticsToggle.checked,
      replay: replayToggle.checked,
      choice: "custom",
    });
  });
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

function showSlide(index) {
  if (slides.length === 0) {
    return;
  }
  slides[active].classList.remove("is-active");
  active = index;
  slides[active].classList.add("is-active");
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

function createProductCard(product) {
  return `
    <article class="product-card">
      <div class="product-media">
        <span class="discount-badge">${product.discount}</span>
        <div class="image-placeholder">
          <span>Placeholder immagine</span>
        </div>
      </div>
      <div class="product-body">
        <h4>${product.name}</h4>
        <div class="product-prices" aria-label="Prezzo">
          <span class="price-original">${product.original}</span>
          <strong>${product.finalPrice}</strong>
        </div>
        ${createSizesMarkup(product)}
        <div class="product-actions">
          <button type="button" data-add-to-cart="${product.name}">Aggiungi al carrello</button>
          <button type="button" data-buy-now="${product.name}">Acquista ora</button>
        </div>
      </div>
    </article>
  `;
}

function getAllProducts() {
  return catalogSections.flatMap((section) =>
    section.categories.flatMap((category) => category.products)
  );
}

function findProduct(productName) {
  return getAllProducts().find((product) => product.name === productName);
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

  catalogRoot.innerHTML = catalogSections
    .map(
      (section) => `
        <section class="catalog-gender" id="${section.id}">
          <header class="catalog-gender-heading">
            <p>Haller Boutique</p>
            <h2>${section.title}</h2>
          </header>
          <div class="catalog-categories">
            ${section.categories
              .map(
                (category) => `
                  <section class="catalog-category">
                    <header class="catalog-category-heading">
                      <h3>${category.name}</h3>
                      <span>${category.discount}</span>
                    </header>
                    <div class="product-grid">
                      ${category.products.map(createProductCard).join("")}
                    </div>
                  </section>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");
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
updateCartCount();

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

if (slides.length > 0) {
  window.setInterval(() => {
    showSlide((active + 1) % slides.length);
  }, 5200);
}

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-to-cart]");
  const buyButton = event.target.closest("[data-buy-now]");

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
