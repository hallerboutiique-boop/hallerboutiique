const adminLogin = document.querySelector("[data-admin-login]");
const adminPanel = document.querySelector("[data-admin-panel]");
const adminMessage = document.querySelector("[data-admin-message]");
const usersTable = document.querySelector("[data-users-table]");
const ordersTable = document.querySelector("[data-orders-table]");
const adminTotal = document.querySelector("[data-admin-total]");
const metricGrid = document.querySelector("[data-metric-grid]");
const replaySessionsRoot = document.querySelector("[data-replay-sessions]");
const replayPlayer = document.querySelector("[data-replay-player]");
const adminProductsRoot = document.querySelector("[data-admin-products]");
const productForm = document.querySelector("[data-product-form]");
const productSearch = document.querySelector("[data-product-search]");
const productMessage = document.querySelector("[data-product-message]");
const productImageUpload = document.querySelector("[data-product-image-upload]");
const productImageButton = document.querySelector("[data-product-image-button]");
const productUploadStatus = document.querySelector("[data-product-upload-status]");
const productPreviews = document.querySelector("[data-product-previews]");
const aiProductImage = document.querySelector("[data-ai-product-image]");
const aiProductButton = document.querySelector("[data-ai-product-button]");
const aiProductStatus = document.querySelector("[data-ai-product-status]");
const aiProductProgress = document.querySelector("[data-ai-product-progress]");
const aiProductProgressBar = document.querySelector("[data-ai-product-progress-bar]");
const aiProductProgressLabel = document.querySelector("[data-ai-product-progress-label]");
const productCropDialog = document.querySelector("[data-product-crop-dialog]");
const productCropStage = document.querySelector("[data-product-crop-stage]");
const productCropImage = document.querySelector("[data-product-crop-image]");
const productCropPreviewMedia = document.querySelector("[data-product-crop-preview-media]");
const productCropPreviewImage = document.querySelector("[data-product-crop-preview-image]");
const productCropPreviewName = document.querySelector("[data-product-crop-preview-name]");
const productCropZoom = document.querySelector("[data-product-crop-zoom]");
const productCropConfirm = document.querySelector("[data-product-crop-confirm]");
let replayTimers = [];
let adminProducts = [];
let selectedProductId = "";
let cropState = null;
let cropDrag = null;
let productUploadQueue = null;

function setAdminMessage(message, type = "") {
  if (!adminMessage) return;
  adminMessage.textContent = message || "";
  adminMessage.dataset.type = type;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.message || "Operazione non riuscita.");
  return data;
}

async function uploadApi(path, body) {
  const response = await fetch(path, { method: "POST", body });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.message || "Upload non riuscito.");
  return data;
}

async function uploadApiWithProgress(path, body, onProgress) {
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

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}€`;
}

function escapeHtml(value) {
  return String(value || "-").replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function emptyState(text) {
  return `<p class="admin-empty">${escapeHtml(text)}</p>`;
}

function setProductMessage(message, type = "") {
  if (!productMessage) return;
  productMessage.textContent = message || "";
  productMessage.dataset.type = type;
}

function setProductUploadStatus(message) {
  if (!productUploadStatus) return;
  productUploadStatus.textContent = message || "";
}

function setAiProductStatus(message, type = "") {
  if (!aiProductStatus) return;
  aiProductStatus.textContent = message || "";
  aiProductStatus.dataset.type = type;
}

function setAiProductProgress(progress, message = "", type = "") {
  if (!aiProductProgress || !aiProductProgressBar || !aiProductProgressLabel) return;
  const value = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  aiProductProgress.hidden = false;
  aiProductProgress.dataset.type = type;
  aiProductProgressBar.style.setProperty("--ai-progress", `${value}%`);
  aiProductProgressBar.parentElement?.setAttribute("aria-valuenow", String(value));
  aiProductProgressLabel.textContent = message;
}

function formatAdminProductPrice(value) {
  return String(value || "").replace("€", "").trim();
}

function productImageUrl(src) {
  const value = String(src || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function currentProductImages() {
  return String(productForm?.elements.images.value || "")
    .split(/\r?\n/)
    .map((image) => image.trim())
    .filter(Boolean);
}

function renderProductPreviews(images = currentProductImages()) {
  if (!productPreviews) return;
  if (!images.length) {
    productPreviews.innerHTML = `<p class="admin-empty">Nessuna immagine caricata per questo prodotto.</p>`;
    return;
  }
  productPreviews.innerHTML = images
    .map(
      (image, index) => `
        <figure class="product-preview-item">
          <img src="${escapeHtml(productImageUrl(image))}" alt="Anteprima prodotto ${index + 1}" loading="lazy">
          <figcaption>Foto ${index + 1}</figcaption>
        </figure>
      `
    )
    .join("");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cropOutputName(file, mimeType) {
  const base = String(file?.name || "prodotto").replace(/\.[^.]+$/, "").trim() || "prodotto";
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[String(mimeType || "").toLowerCase()] || "jpg";
  return `${base}-ritaglio.${extension}`;
}

function refreshCropStorefrontCopy(source) {
  if (!productCropPreviewName) return;
  const selectedName = String(productForm?.elements.name?.value || "").trim();
  productCropPreviewName.textContent = source?.type === "manual" && selectedName ? selectedName : "Nuovo prodotto";
}

function updateCropPreview() {
  if (!cropState || !productCropStage || !productCropImage || !productCropPreviewMedia || !productCropPreviewImage) return;
  const stageBounds = productCropStage.getBoundingClientRect();
  if (!stageBounds.width || !stageBounds.height || !cropState.sourceWidth || !cropState.sourceHeight) return;

  const baseScale = Math.max(stageBounds.width / cropState.sourceWidth, stageBounds.height / cropState.sourceHeight);
  const imageScale = baseScale * cropState.zoom;
  const imageWidth = cropState.sourceWidth * imageScale;
  const imageHeight = cropState.sourceHeight * imageScale;
  const maxOffsetX = Math.max(0, (imageWidth - stageBounds.width) / 2);
  const maxOffsetY = Math.max(0, (imageHeight - stageBounds.height) / 2);
  cropState.baseScale = baseScale;
  cropState.stageWidth = stageBounds.width;
  cropState.stageHeight = stageBounds.height;
  cropState.offsetX = clamp(cropState.offsetX, -maxOffsetX, maxOffsetX);
  cropState.offsetY = clamp(cropState.offsetY, -maxOffsetY, maxOffsetY);

  const applyPosition = (image, containerBounds) => {
    const ratio = containerBounds.width / stageBounds.width;
    image.style.width = `${imageWidth * ratio}px`;
    image.style.left = `${containerBounds.width / 2 + cropState.offsetX * ratio}px`;
    image.style.top = `${containerBounds.height / 2 + cropState.offsetY * ratio}px`;
    image.style.transform = "translate(-50%, -50%)";
  };

  applyPosition(productCropImage, stageBounds);
  const previewBounds = productCropPreviewMedia.getBoundingClientRect();
  if (previewBounds.width && previewBounds.height) applyPosition(productCropPreviewImage, previewBounds);
}

function closeProductCropper() {
  const objectUrl = cropState?.objectUrl;
  cropState = null;
  cropDrag = null;
  productCropStage?.classList.remove("is-dragging");
  if (productCropDialog?.open) productCropDialog.close();
  if (productCropImage) productCropImage.removeAttribute("src");
  if (productCropPreviewImage) productCropPreviewImage.removeAttribute("src");
  if (objectUrl) URL.revokeObjectURL(objectUrl);
}

function cancelProductCropper() {
  const source = cropState?.source;
  closeProductCropper();
  if (source?.type === "manual") {
    productUploadQueue = null;
    if (productImageButton) productImageButton.disabled = false;
    if (productImageUpload) productImageUpload.value = "";
    setProductUploadStatus("Caricamento annullato.");
    return;
  }
  if (source?.type === "ai") {
    if (aiProductImage) aiProductImage.value = "";
    setAiProductStatus("Creazione bozza annullata.");
  }
}

function openProductCropper(file, source) {
  if (!productCropDialog || !productCropImage || !productCropPreviewImage || !productCropZoom) {
    throw new Error("Ritaglio immagine non disponibile.");
  }
  if (!file?.type?.startsWith("image/")) throw new Error("Seleziona una immagine valida.");

  closeProductCropper();
  cropState = {
    file,
    source,
    objectUrl: URL.createObjectURL(file),
    sourceWidth: 0,
    sourceHeight: 0,
    baseScale: 1,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    stageWidth: 0,
    stageHeight: 0,
  };
  productCropZoom.value = "1";
  productCropConfirm.textContent = source.type === "ai" ? "Ritaglia e crea bozza" : "Applica ritaglio e carica";
  productCropConfirm.disabled = true;
  refreshCropStorefrontCopy(source);
  productCropImage.src = cropState.objectUrl;
  productCropPreviewImage.src = cropState.objectUrl;
  if (typeof productCropDialog.showModal === "function") productCropDialog.showModal();
  else productCropDialog.setAttribute("open", "");
}

function createCroppedProductImage() {
  if (!cropState || !cropState.sourceWidth || !cropState.sourceHeight || !cropState.stageWidth) {
    throw new Error("L'immagine non e ancora pronta.");
  }
  const imageScale = cropState.baseScale * cropState.zoom;
  const sourceCropSize = Math.min(cropState.stageWidth / imageScale, cropState.sourceWidth, cropState.sourceHeight);
  const sourceX = clamp(
    cropState.sourceWidth / 2 - (cropState.stageWidth / 2 + cropState.offsetX) / imageScale,
    0,
    cropState.sourceWidth - sourceCropSize
  );
  const sourceY = clamp(
    cropState.sourceHeight / 2 - (cropState.stageHeight / 2 + cropState.offsetY) / imageScale,
    0,
    cropState.sourceHeight - sourceCropSize
  );
  const outputSize = Math.min(1600, Math.max(1, Math.round(sourceCropSize)));
  const sourceFile = cropState.file;
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossibile preparare il ritaglio.");
  context.drawImage(productCropImage, sourceX, sourceY, sourceCropSize, sourceCropSize, 0, 0, outputSize, outputSize);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Impossibile creare il ritaglio."));
          return;
        }
        resolve({ blob, name: cropOutputName(sourceFile, blob.type) });
      },
      "image/webp",
      0.92
    );
  });
}

async function uploadCroppedProductImage(image, productId, position, total) {
  const formData = new FormData();
  formData.append("productId", productId);
  formData.append("images", image.blob, image.name);
  setProductUploadStatus(`Caricamento foto ${position} di ${total}...`);
  setProductMessage("");
  const data = await uploadApi("/api/admin/product-images", formData);
  const current = currentProductImages();
  productForm.elements.images.value = [...current, ...(data.images || [])].join("\n");
  selectedProductId = productId;
  await loadProducts();
  const product = adminProducts.find((entry) => entry.id === productId);
  if (product) fillProductForm(product);
}

async function createAiProductFromImage(image) {
  const formData = new FormData();
  formData.append("image", image.blob, image.name);
  aiProductButton.disabled = true;
  setAiProductProgress(4, "Invio foto al server");
  setAiProductStatus("Invio foto al server...");
  setProductMessage("");
  try {
    const data = await uploadApiWithProgress("/api/admin/ai-product?progress=1", formData, (event) => {
      setAiProductProgress(event.progress, event.message);
      setAiProductStatus(event.message);
    });
    const suggestion = {
      ...(data.suggestion || {}),
      images: data.suggestion?.images || (data.image ? [data.image] : []),
    };
    fillAiProductDraft(suggestion);
    setAiProductProgress(100, "Bozza prodotto pronta", "success");
    setAiProductStatus("Bozza AI pronta. Controlla i dati e premi Salva prodotto.", "success");
    setProductMessage("Bozza prodotto creata con AI.", "success");
  } catch (error) {
    setAiProductProgress(100, "Analisi non riuscita", "error");
    setAiProductStatus(error.message, "error");
    setProductMessage(error.message, "error");
  } finally {
    aiProductButton.disabled = false;
    aiProductImage.value = "";
  }
}

function openNextProductCrop() {
  if (!productUploadQueue) return;
  const { files, index, productId } = productUploadQueue;
  const file = files[index];
  if (!file) return;
  setProductUploadStatus(`Ritaglia foto ${index + 1} di ${files.length}.`);
  openProductCropper(file, { type: "manual", productId });
}

async function handleCroppedProductImage(image, source) {
  if (source.type === "ai") {
    await createAiProductFromImage(image);
    return;
  }

  const queue = productUploadQueue;
  if (!queue) return;
  try {
    await uploadCroppedProductImage(image, source.productId, queue.index + 1, queue.files.length);
  } catch (error) {
    setProductUploadStatus("Upload non riuscito.");
    setProductMessage(error.message, "error");
    productUploadQueue = null;
    productImageButton.disabled = false;
    productImageUpload.value = "";
    return;
  }

  queue.index += 1;
  if (queue.index < queue.files.length) {
    openNextProductCrop();
    return;
  }
  setProductUploadStatus(`${queue.files.length} foto ritagliate e collegate al prodotto.`);
  setProductMessage("Foto caricate. Prodotto aggiornato.", "success");
  productUploadQueue = null;
  productImageButton.disabled = false;
  productImageUpload.value = "";
}

function deviceLine(session) {
  const model = session.deviceModel || session.device || "Dispositivo";
  const os = [session.os, session.osVersion].filter(Boolean).join(" ") || session.device || "";
  const browser = session.browser || "";
  const screen = session.screen ? `schermo ${session.screen}` : "";
  return [model, os, browser, screen].filter(Boolean).join(" · ");
}

function locationLine(session) {
  const location = session.ipLocation || {};
  const place = [location.city, location.country].filter(Boolean).join(", ");
  return place || "Localizzazione non disponibile";
}

function displayIp(session) {
  return session.ipAddress || session.ip || session.ipMasked || "-";
}

function preciseLocationText(session) {
  const location = session.preciseLocation;
  if (!location || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
    const labels = {
      denied: "GPS negato",
      timeout: "GPS timeout",
      unsupported: "GPS non supportato",
      unavailable: "GPS non disponibile",
      error: "GPS errore",
    };
    return labels[session.preciseLocationStatus] || "GPS non disponibile";
  }
  const accuracy = Number.isFinite(location.accuracy) ? ` ±${Math.round(location.accuracy)}m` : "";
  return `GPS ${location.latitude}, ${location.longitude}${accuracy}`;
}

function preciseLocationHtml(session) {
  const location = session.preciseLocation;
  const text = preciseLocationText(session);
  if (!location || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
    return `<span class="location-status">${escapeHtml(text)}</span>`;
  }
  const href = `https://www.google.com/maps?q=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
  return `<a class="location-map-link" href="${href}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;
}

function historyMetric(label, value) {
  return `
    <div class="history-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function historyField(label, value) {
  const normalized = value === 0 ? "0" : value || "-";
  return `
    <div class="history-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(normalized)}</strong>
    </div>
  `;
}

function historyFieldHtml(label, html) {
  return `
    <div class="history-field">
      <span>${escapeHtml(label)}</span>
      <strong>${html}</strong>
    </div>
  `;
}

function historyBadge(label, tone = "") {
  return `<span class="history-badge${tone ? ` history-badge-${tone}` : ""}">${escapeHtml(label)}</span>`;
}

function preciseLocationStatusLabel(session) {
  if (session.preciseLocation) return "Autorizzata";
  const labels = {
    denied: "Negata",
    timeout: "Timeout",
    unsupported: "Non supportata",
    unavailable: "Non disponibile",
    error: "Errore",
  };
  return labels[session.preciseLocationStatus] || "";
}

function historyBadges(session) {
  const badges = [];
  if (session.isLive) badges.push(historyBadge("Live", "live"));
  if (session.preciseLocation) badges.push(historyBadge("GPS preciso", "ok"));
  else if (session.preciseLocationStatus) badges.push(historyBadge(preciseLocationText(session), "warn"));
  if (session.checkoutStarted && !session.orderPlaced) badges.push(historyBadge("Checkout", "warn"));
  if (session.orderPlaced) badges.push(historyBadge("Ordine", "ok"));
  if (Number(session.replayEvents || 0) > 0) badges.push(historyBadge("Replay", "info"));
  return badges.length ? badges.join("") : historyBadge("Visita", "info");
}

function referrerLabel(referrer) {
  if (!referrer) return "Diretto";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

function renderHistoryCard(session) {
  const gps = session.preciseLocation;
  const gpsCaptured = gps?.capturedAt || session.preciseLocationAt;
  const status = session.orderPlaced
    ? "Ordine completato"
    : session.checkoutStarted
      ? "Checkout avviato"
      : "Navigazione";
  return `
    <article class="history-session">
      <header class="history-session-head">
        <div>
          <strong>${escapeHtml(session.path || "/")}</strong>
          <small>Ultima attivita ${formatDate(session.lastSeenAt)}</small>
        </div>
        <div class="history-badges">${historyBadges(session)}</div>
      </header>

      <div class="history-category-grid">
        <section class="history-category">
          <h3>Sessione</h3>
          ${historyField("Primo accesso", formatDate(session.startedAt))}
          ${historyField("Ultimo accesso", formatDate(session.lastSeenAt))}
          ${historyField("Durata", formatDuration(session.durationMs))}
          ${historyField("Pagina ingresso", session.landingPage || session.path || "/")}
        </section>

        <section class="history-category">
          <h3>Dispositivo</h3>
          ${historyField("Modello", session.deviceModel || session.device || "Dispositivo")}
          ${historyField("Sistema", [session.os, session.osVersion].filter(Boolean).join(" "))}
          ${historyField("Browser", session.browser)}
          ${historyField("Schermo", session.screen || session.viewport)}
        </section>

        <section class="history-category">
          <h3>Rete</h3>
          ${historyField("IP", displayIp(session))}
          ${historyField("Localita IP", locationLine(session))}
          ${historyField("Referrer", referrerLabel(session.referrer))}
          ${historyField("Timezone", session.timezone)}
        </section>

        <section class="history-category">
          <h3>Posizione</h3>
          ${historyFieldHtml("GPS", preciseLocationHtml(session))}
          ${historyField("Acquisita", gpsCaptured ? formatDate(gpsCaptured) : "")}
          ${historyField("Accuratezza", Number.isFinite(gps?.accuracy) ? `${Math.round(gps.accuracy)}m` : "")}
          ${historyField("Stato", preciseLocationStatusLabel(session))}
        </section>

        <section class="history-category">
          <h3>Comportamento</h3>
          ${historyField("Stato", status)}
          ${historyField("Pageview", session.pageviews || 0)}
          ${historyField("Eventi", session.eventsCount || 0)}
          ${historyField("Scroll max", `${Math.round(Number(session.maxScroll || 0))}%`)}
        </section>
      </div>
    </article>
  `;
}

function renderMetrics(metrics) {
  const kpi = metrics.kpis;
  const cards = [
    ["Visite live", kpi.liveVisitors, "ultimi 2 minuti"],
    ["Visitatori", kpi.visitors, `${kpi.visitors24h} nelle 24h`],
    ["Pageview", kpi.pageviews, `${kpi.pageviews24h} nelle 24h`],
    ["Conversione", `${(kpi.conversionRate * 100).toFixed(1)}%`, `${kpi.orders} ordini`],
    ["Checkout abbandonati", kpi.abandonedCheckouts, `${kpi.checkoutStarts} checkout avviati`],
    ["Incassi", formatMoney(kpi.revenue), `AOV ${formatMoney(kpi.averageOrderValue)}`],
    ["Tempo medio", formatDuration(kpi.averageDurationMs), "per sessione"],
    ["Utenti registrati", kpi.users, "account creati"],
  ];

  metricGrid.innerHTML = cards
    .map(
      ([label, value, detail]) => `
        <article class="metric-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(detail)}</p>
        </article>
      `
    )
    .join("");
}

function renderChart(selector, rows, valueLabel = "") {
  const root = document.querySelector(selector);
  if (!root) return;
  if (!rows || rows.length === 0) {
    root.innerHTML = emptyState("Nessun dato disponibile.");
    return;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);
  root.innerHTML = rows
    .map(
      (row) => `
        <div class="chart-row">
          <div>
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}${valueLabel}</strong>
          </div>
          <i style="--bar:${Math.max(4, Math.round((row.value / max) * 100))}%"></i>
        </div>
      `
    )
    .join("");
}

function renderLiveSessions(sessions) {
  const root = document.querySelector("[data-live-sessions]");
  if (!root) return;
  if (!sessions || sessions.length === 0) {
    root.innerHTML = emptyState("Nessun visitatore live.");
    return;
  }
  root.innerHTML = sessions
    .map(
      (session) => `
        <article class="live-session">
          <strong>${escapeHtml(session.path || "/")}</strong>
          <span>${escapeHtml(deviceLine(session))} · IP ${escapeHtml(displayIp(session))} · ${preciseLocationHtml(session)} · IP geo ${escapeHtml(locationLine(session))}</span>
          <small>${formatDate(session.lastSeenAt)} · ${formatDuration(session.durationMs)}</small>
        </article>
      `
    )
    .join("");
}

function renderVisitHistory(sessions) {
  const root = document.querySelector("[data-visit-history]");
  if (!root) return;
  if (!sessions || sessions.length === 0) {
    root.innerHTML = emptyState("Nessuno storico visite ancora.");
    return;
  }
  const stats = [
    ["Totali", sessions.length],
    ["Live", sessions.filter((session) => session.isLive).length],
    ["GPS preciso", sessions.filter((session) => session.preciseLocation).length],
    ["Checkout", sessions.filter((session) => session.checkoutStarted && !session.orderPlaced).length],
    ["Ordini", sessions.filter((session) => session.orderPlaced).length],
    ["Replay", sessions.filter((session) => Number(session.replayEvents || 0) > 0).length],
  ];
  root.innerHTML = `
    <div class="history-summary">
      ${stats.map(([label, value]) => historyMetric(label, value)).join("")}
    </div>
    <div class="history-list-group">
      ${sessions.map(renderHistoryCard).join("")}
    </div>
  `;
}

function renderFunnel(metrics) {
  const root = document.querySelector("[data-funnel]");
  if (!root) return;
  const kpi = metrics.kpis;
  const rows = [
    ["Visitatori", kpi.visitors],
    ["Checkout avviati", kpi.checkoutStarts],
    ["Ordini", kpi.orders],
    ["Abbandonati", kpi.abandonedCheckouts],
  ];
  root.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="funnel-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderTopProducts(products) {
  const root = document.querySelector("[data-top-products]");
  if (!root) return;
  if (!products || products.length === 0) {
    root.innerHTML = emptyState("Nessun prodotto venduto.");
    return;
  }
  root.innerHTML = products
    .map(
      (product) => `
        <article class="product-row-admin">
          <strong>${escapeHtml(product.name)}</strong>
          <span>${escapeHtml(product.quantity)} venduti · ${formatMoney(product.revenue)}</span>
        </article>
      `
    )
    .join("");
}

function fillProductForm(product) {
  if (!productForm || !product) return;
  selectedProductId = product.id;
  productForm.elements.id.value = product.id;
  productForm.elements.name.value = product.name || "";
  productForm.elements.collection.value = product.collection || "";
  productForm.elements.category.value = product.category || "";
  if (productForm.elements.description) productForm.elements.description.value = product.description || "";
  productForm.elements.original.value = formatAdminProductPrice(product.original);
  productForm.elements.finalPrice.value = formatAdminProductPrice(product.finalPrice);
  productForm.elements.discount.value = product.discount || "";
  productForm.elements.sizeType.value = product.sizeType || "none";
  productForm.elements.sizes.value = Array.isArray(product.sizes) ? product.sizes.join(", ") : "";
  productForm.elements.inventory.value = Number.isInteger(product.inventory) ? String(product.inventory) : "";
  productForm.elements.images.value = Array.isArray(product.images) ? product.images.join("\n") : "";
  renderProductPreviews(product.images || []);
  setProductMessage("");
  renderAdminProducts();
}

function fillAiProductDraft(suggestion) {
  if (!productForm || !suggestion) return;
  selectedProductId = "";
  productForm.elements.id.value = "";
  productForm.elements.name.value = suggestion.name || "";
  productForm.elements.collection.value = suggestion.collection || "Selezione Haller Boutique";
  productForm.elements.category.value = suggestion.category || "";
  if (productForm.elements.description) productForm.elements.description.value = suggestion.description || "";
  productForm.elements.original.value = "";
  productForm.elements.finalPrice.value = "";
  productForm.elements.discount.value = "";
  productForm.elements.sizeType.value = suggestion.sizeType || "none";
  productForm.elements.sizes.value = Array.isArray(suggestion.sizes) ? suggestion.sizes.join(", ") : "";
  productForm.elements.inventory.value = "";
  productForm.elements.images.value = Array.isArray(suggestion.images) ? suggestion.images.join("\n") : "";
  renderProductPreviews(suggestion.images || []);
  renderAdminProducts();
}

function filteredAdminProducts() {
  const query = (productSearch?.value || "").trim().toLowerCase();
  if (!query) return adminProducts;
  return adminProducts.filter((product) =>
    [product.name, product.collection, product.category, product.discount]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  );
}

function renderAdminProducts() {
  if (!adminProductsRoot) return;
  const products = filteredAdminProducts();
  if (products.length === 0) {
    adminProductsRoot.innerHTML = emptyState("Nessun prodotto trovato.");
    return;
  }
  adminProductsRoot.innerHTML = products
    .map(
      (product) => {
        const image = Array.isArray(product.images) && product.images.length ? product.images[0] : "";
        return `
        <button class="admin-product-item${product.id === selectedProductId ? " is-active" : ""}" type="button" data-product-id="${escapeHtml(product.id)}">
          <span class="admin-product-thumb">
            ${
              image
                ? `<img src="${escapeHtml(productImageUrl(image))}" alt="${escapeHtml(product.name)}" loading="lazy">`
                : `<i data-lucide="image"></i>`
            }
          </span>
          <span class="admin-product-text">
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(product.collection)} · ${escapeHtml(product.category)}</span>
            <small>${escapeHtml(product.original)} → ${escapeHtml(product.finalPrice)} · ${escapeHtml(product.discount)} · ${escapeHtml(product.sizeType)} · ${Number.isInteger(product.inventory) ? `${product.inventory} in inventario` : "inventario da definire"}${product.custom ? " · custom" : ""}</small>
          </span>
        </button>
      `;
      }
    )
    .join("");
  if (window.lucide) window.lucide.createIcons();
}

async function loadProducts() {
  const data = await api("/api/admin/products");
  adminProducts = data.products || [];
  renderAdminProducts();
  const selected = adminProducts.find((product) => product.id === selectedProductId);
  if (selected) {
    fillProductForm(selected);
  } else if (adminProducts.length) {
    fillProductForm(adminProducts[0]);
  }
}

function renderOrders(orders) {
  if (!ordersTable) return;
  if (!orders || orders.length === 0) {
    ordersTable.innerHTML = `<tr><td colspan="8">Nessun ordine ancora.</td></tr>`;
    return;
  }
  ordersTable.innerHTML = orders
    .map((order) => {
      const products =
        (order.products || [])
          .map((product) => [product.name, product.size ? `taglia ${product.size}` : ""].filter(Boolean).join(" - "))
          .join(", ") || "-";
      const customer = [order.customer?.name, order.customer?.email, order.customer?.phone]
        .filter(Boolean)
        .map(escapeHtml)
        .join("<br>");
      const orderDevice = deviceLine({
        ...(order.userAgent || {}),
        screen: order.deviceInfo?.screen,
      });
      return `
        <tr>
          <td>${escapeHtml(order.orderCode)}</td>
          <td>${customer || "-"}</td>
          <td>${escapeHtml(products)}</td>
          <td>${escapeHtml(order.paymentMethod)}</td>
          <td>${escapeHtml(orderDevice)}</td>
          <td>${escapeHtml(order.total || formatMoney(order.totalValue))}</td>
          <td>${escapeHtml(order.status)}</td>
          <td>${formatDate(order.createdAt)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderUsers(users) {
  if (!usersTable) return;
  if (!users || users.length === 0) {
    usersTable.innerHTML = `<tr><td colspan="6">Nessun utente registrato.</td></tr>`;
    return;
  }
  usersTable.innerHTML = users
    .map(
      (user) => `
        <tr>
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.phone)}</td>
          <td>${escapeHtml((user.providers || [user.provider]).join(", "))}</td>
          <td>${formatDate(user.createdAt)}</td>
          <td>${formatDate(user.lastLoginAt)}</td>
        </tr>
      `
    )
    .join("");
}

function renderActivity(events) {
  const root = document.querySelector("[data-activity-list]");
  if (!root) return;
  if (!events || events.length === 0) {
    root.innerHTML = emptyState("Nessuna attivita recente.");
    return;
  }
  root.innerHTML = events
    .map(
      (event) => `
        <article class="activity-row">
          <span>${formatDate(event.at)}</span>
          <strong>${escapeHtml(event.type)}</strong>
          <p>${escapeHtml(event.path)}${event.product ? ` · ${escapeHtml(event.product)}` : ""}${event.method ? ` · ${escapeHtml(event.method)}` : ""}</p>
        </article>
      `
    )
    .join("");
}

function replayEventLabel(event) {
  const labels = {
    page: "Pagina aperta",
    move: "Movimento mouse",
    click: "Click",
    scroll: "Scroll",
    resize: "Resize",
    input: "Campo modificato",
    checkout: "Checkout",
    order: "Ordine",
  };
  const detail = [event.target, event.text, event.field ? `campo ${event.field}` : ""].filter(Boolean).join(" · ");
  return `${labels[event.type] || event.type}${detail ? ` · ${detail}` : ""}`;
}

function clearReplayTimers() {
  replayTimers.forEach((timer) => window.clearTimeout(timer));
  replayTimers = [];
}

function renderReplaySessions(sessions) {
  if (!replaySessionsRoot) return;
  if (!sessions || sessions.length === 0) {
    replaySessionsRoot.innerHTML = `
      <div class="replay-help">
        <strong>Nessun video registrato ancora.</strong>
        <p>Per vedere un video: apri il sito in una nuova scheda, premi "Accetta tutto" nel banner cookie, naviga/clicca qualche prodotto per almeno 10 secondi, poi torna qui e premi Aggiorna.</p>
      </div>
    `;
    return;
  }
  replaySessionsRoot.innerHTML = sessions
    .map(
      (session) => `
        <article class="replay-session">
          <div>
            <strong>${escapeHtml(session.path || "/")}</strong>
            <span>${escapeHtml(deviceLine(session))} · IP ${escapeHtml(displayIp(session))} · ${preciseLocationHtml(session)} · IP geo ${escapeHtml(locationLine(session))} · ${escapeHtml(session.events)} eventi</span>
            <span>${formatDate(session.replayLastAt || session.lastSeenAt)} · ${formatDuration(session.durationMs)}</span>
          </div>
          <button type="button" data-replay-session="${escapeHtml(session.id)}">Guarda video</button>
        </article>
      `
    )
    .join("");
}

function eventPosition(event, screen) {
  const sourceWidth = Number(event.w || window.innerWidth || 1);
  const sourceHeight = Number(event.h || window.innerHeight || 1);
  return {
    x: Math.max(0, Math.min(screen.clientWidth, (Number(event.x || 0) / sourceWidth) * screen.clientWidth)),
    y: Math.max(0, Math.min(screen.clientHeight, (Number(event.y || 0) / sourceHeight) * screen.clientHeight)),
  };
}

function replaySource(path) {
  try {
    const safePath = String(path || "/").startsWith("/") && !String(path || "").startsWith("//") ? String(path || "/") : "/";
    const url = new URL(safePath, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname.includes("admin")) return "/index.html?replay_view=1";
    url.searchParams.set("replay_view", "1");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/index.html?replay_view=1";
  }
}

function scrollReplayFrame(frame, scrollY) {
  try {
    frame?.contentWindow?.scrollTo({ top: Number(scrollY || 0), left: 0, behavior: "auto" });
  } catch {
    // Same-origin in normal use; if blocked, the cursor replay still works.
  }
}

function playReplay(events) {
  clearReplayTimers();
  const screen = replayPlayer?.querySelector("[data-replay-screen]");
  const frame = replayPlayer?.querySelector("[data-replay-frame]");
  const cursor = replayPlayer?.querySelector("[data-replay-cursor]");
  const ring = replayPlayer?.querySelector("[data-replay-click]");
  const progress = replayPlayer?.querySelector("[data-replay-progress]");
  const current = replayPlayer?.querySelector("[data-replay-current]");
  const rows = Array.from(replayPlayer?.querySelectorAll("[data-replay-event-row]") || []);
  if (!screen || !cursor || !progress || events.length === 0) return;

  const maxTime = Math.max(...events.map((event) => Number(event.t || 0)), 1);
  progress.style.setProperty("--progress", "0%");
  rows.forEach((row) => row.classList.remove("is-active"));
  events.forEach((event, index) => {
    const delay = Math.min(16000, Math.round((Number(event.t || 0) / maxTime) * 16000));
    replayTimers.push(
      window.setTimeout(() => {
        rows.forEach((row) => row.classList.remove("is-active"));
        rows[index]?.classList.add("is-active");
        progress.style.setProperty("--progress", `${Math.round(((index + 1) / events.length) * 100)}%`);
        if (current) current.textContent = replayEventLabel(event);
        screen.dataset.page = `${event.path || ""} · ${replayEventLabel(event)}`.slice(0, 120);
        if (event.type === "page") {
          scrollReplayFrame(frame, event.scrollY || 0);
        }
        if (event.type === "move" || event.type === "click") {
          const position = eventPosition(event, screen);
          cursor.style.left = `${position.x}px`;
          cursor.style.top = `${position.y}px`;
          if (event.type === "click" && ring) {
            ring.style.left = `${position.x}px`;
            ring.style.top = `${position.y}px`;
            ring.classList.remove("is-active");
            void ring.offsetWidth;
            ring.classList.add("is-active");
          }
        }
        if (event.type === "scroll") {
          screen.dataset.page = `${event.path || ""} · scroll ${Math.round(Number(event.depth || 0))}%`;
          scrollReplayFrame(frame, event.scrollY || 0);
        }
      }, delay)
    );
  });
}

function renderReplayPlayer(replay) {
  if (!replayPlayer) return;
  clearReplayTimers();
  const events = Array.isArray(replay.events) ? replay.events : [];
  if (events.length === 0) {
    replayPlayer.innerHTML = emptyState("Replay vuoto.");
    return;
  }
  const firstPath = events.find((event) => event.path)?.path || replay.path || "/";
  replayPlayer.innerHTML = `
    <div class="replay-meta">
      <span>${escapeHtml(replay.path || "/")}</span>
      <span>${escapeHtml(deviceLine(replay))}</span>
      <span>IP ${escapeHtml(displayIp(replay))}</span>
      <span>${preciseLocationHtml(replay)}</span>
      <span>IP geo ${escapeHtml(locationLine(replay))}</span>
      <span>${escapeHtml(events.length)} eventi</span>
    </div>
    <div class="replay-controls">
      <button type="button" data-replay-play>Riproduci video</button>
      <div class="replay-progress" data-replay-progress><i></i></div>
    </div>
    <div class="replay-screen" data-replay-screen data-page="${escapeHtml(firstPath)}">
      <iframe class="replay-frame" data-replay-frame src="${escapeHtml(replaySource(firstPath))}" title="Pagina visitata dall'utente" tabindex="-1"></iframe>
      <div class="replay-frame-shade"></div>
      <strong class="replay-current" data-replay-current>Pronto per riprodurre</strong>
      <span class="replay-cursor" data-replay-cursor style="left: 50%; top: 50%;"></span>
      <span class="replay-click-ring" data-replay-click></span>
    </div>
    <div class="replay-event-log">
      ${events
        .map(
          (event, index) => `
            <p data-replay-event-row="${index}">
              <strong>${formatDuration(event.t)}</strong> · ${escapeHtml(replayEventLabel(event))}
            </p>
          `
        )
        .join("")}
    </div>
  `;
  replayPlayer.querySelector("[data-replay-play]")?.addEventListener("click", () => playReplay(events));
  window.setTimeout(() => playReplay(events), 350);
}

async function loadReplay(sessionId) {
  if (!replayPlayer) return;
  replayPlayer.innerHTML = emptyState("Carico replay...");
  try {
    const data = await api(`/api/admin/replay?sessionId=${encodeURIComponent(sessionId)}`);
    renderReplayPlayer(data.replay);
  } catch (error) {
    replayPlayer.innerHTML = emptyState(error.message);
  }
}

function renderDashboard(metrics) {
  adminTotal.textContent = `${metrics.kpis.liveVisitors} live`;
  renderMetrics(metrics);
  renderLiveSessions(metrics.liveSessions);
  renderVisitHistory(metrics.visitHistory);
  renderFunnel(metrics);
  renderTopProducts(metrics.topProducts);
  renderOrders(metrics.recentOrders);
  renderActivity(metrics.recentEvents);
  renderReplaySessions(metrics.replaySessions);
  renderChart("[data-devices]", metrics.devices);
  renderChart("[data-device-models]", metrics.deviceModels);
  renderChart("[data-browsers]", metrics.browsers);
  renderChart("[data-os-versions]", metrics.osVersions);
  renderChart("[data-pages]", metrics.pages);
  renderChart("[data-referrers]", metrics.referrers);
  renderChart("[data-payments]", metrics.payments);
  renderChart("[data-os]", metrics.os);
}

async function loadDashboard() {
  const [usersData, metricsData] = await Promise.all([
    api("/api/admin/users"),
    api("/api/admin/metrics"),
  ]);
  adminLogin.hidden = true;
  adminPanel.hidden = false;
  renderUsers(usersData.users);
  renderDashboard(metricsData.metrics);
  await loadProducts();
}

adminLogin?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAdminMessage("Accesso in corso...");
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(adminLogin))),
    });
    setAdminMessage("");
    await loadDashboard();
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
});

document.querySelector("[data-admin-refresh]")?.addEventListener("click", loadDashboard);

document.addEventListener("click", (event) => {
  const replayButton = event.target.closest("[data-replay-session]");
  if (replayButton) {
    loadReplay(replayButton.dataset.replaySession);
  }

  const productButton = event.target.closest("[data-product-id]");
  if (productButton) {
    const product = adminProducts.find((entry) => entry.id === productButton.dataset.productId);
    if (product) fillProductForm(product);
  }
});

productSearch?.addEventListener("input", renderAdminProducts);

productForm?.elements.images?.addEventListener("input", () => {
  renderProductPreviews();
});

productCropImage?.addEventListener("load", () => {
  if (!cropState) return;
  cropState.sourceWidth = productCropImage.naturalWidth;
  cropState.sourceHeight = productCropImage.naturalHeight;
  if (productCropConfirm) productCropConfirm.disabled = false;
  window.requestAnimationFrame(updateCropPreview);
});

productCropImage?.addEventListener("error", () => {
  if (!cropState) return;
  const source = cropState.source;
  cancelProductCropper();
  if (source.type === "ai") setAiProductStatus("Immagine non leggibile. Scegli JPG, PNG o WebP.", "error");
  else setProductUploadStatus("Immagine non leggibile. Scegli JPG, PNG o WebP.");
});

productCropZoom?.addEventListener("input", () => {
  if (!cropState) return;
  cropState.zoom = Number(productCropZoom.value) || 1;
  updateCropPreview();
});

productCropStage?.addEventListener("pointerdown", (event) => {
  if (!cropState || event.button !== 0) return;
  cropDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: cropState.offsetX,
    offsetY: cropState.offsetY,
  };
  productCropStage.classList.add("is-dragging");
  productCropStage.setPointerCapture?.(event.pointerId);
  event.preventDefault();
});

productCropStage?.addEventListener("pointermove", (event) => {
  if (!cropState || !cropDrag || cropDrag.pointerId !== event.pointerId) return;
  cropState.offsetX = cropDrag.offsetX + event.clientX - cropDrag.startX;
  cropState.offsetY = cropDrag.offsetY + event.clientY - cropDrag.startY;
  updateCropPreview();
  event.preventDefault();
});

function finishCropDrag(event) {
  if (!cropDrag || cropDrag.pointerId !== event.pointerId) return;
  cropDrag = null;
  productCropStage?.classList.remove("is-dragging");
}

productCropStage?.addEventListener("pointerup", finishCropDrag);
productCropStage?.addEventListener("pointercancel", finishCropDrag);
productCropStage?.addEventListener("lostpointercapture", finishCropDrag);
window.addEventListener("resize", () => window.requestAnimationFrame(updateCropPreview));

document.querySelectorAll("[data-product-crop-cancel]").forEach((button) => {
  button.addEventListener("click", cancelProductCropper);
});

productCropDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  cancelProductCropper();
});

productCropConfirm?.addEventListener("click", async () => {
  if (!cropState) return;
  productCropConfirm.disabled = true;
  const source = cropState.source;
  try {
    const croppedImage = await createCroppedProductImage();
    closeProductCropper();
    await handleCroppedProductImage(croppedImage, source);
  } catch (error) {
    if (source.type === "ai") setAiProductStatus(error.message, "error");
    else setProductUploadStatus(error.message);
    productCropConfirm.disabled = false;
  }
});

productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setProductMessage("Salvataggio in corso...");
  const payload = Object.fromEntries(new FormData(productForm));
  payload.images = String(payload.images || "")
    .split(/\r?\n/)
    .map((image) => image.trim())
    .filter(Boolean);
  try {
    const data = await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    selectedProductId = data.product?.id || payload.id;
    await loadProducts();
    const product = adminProducts.find((entry) => entry.id === selectedProductId);
    if (product) fillProductForm(product);
    setProductMessage("Prodotto salvato.", "success");
  } catch (error) {
    setProductMessage(error.message, "error");
  }
});

document.querySelector("[data-product-reset]")?.addEventListener("click", async () => {
  const id = productForm?.elements.id.value;
  if (!id) return;
  const current = adminProducts.find((product) => product.id === id);
  setProductMessage("Ripristino in corso...");
  try {
    await api("/api/admin/products", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    selectedProductId = current?.custom ? "" : id;
    await loadProducts();
    const product = adminProducts.find((entry) => entry.id === id);
    if (product) fillProductForm(product);
    setProductMessage(current?.custom ? "Prodotto custom eliminato." : "Default ripristinato.", "success");
  } catch (error) {
    setProductMessage(error.message, "error");
  }
});

productImageButton?.addEventListener("click", () => {
  if (!productForm?.elements.id.value) {
    setProductMessage("Seleziona prima un prodotto.", "error");
    return;
  }
  productImageUpload?.click();
});

productImageUpload?.addEventListener("change", () => {
  const files = [...(productImageUpload.files || [])];
  const productId = productForm?.elements.id.value;
  if (!productId || files.length === 0) return;

  setProductMessage("");
  productUploadQueue = { files, productId, index: 0 };
  productImageButton.disabled = true;
  try {
    openNextProductCrop();
  } catch (error) {
    productUploadQueue = null;
    productImageButton.disabled = false;
    setProductUploadStatus("Ritaglio non disponibile.");
    setProductMessage(error.message, "error");
    productImageUpload.value = "";
  }
});

aiProductButton?.addEventListener("click", () => {
  aiProductImage?.click();
});

aiProductImage?.addEventListener("change", () => {
  const file = aiProductImage.files?.[0];
  if (!file) return;
  try {
    openProductCropper(file, { type: "ai" });
  } catch (error) {
    setAiProductStatus(error.message, "error");
    aiProductImage.value = "";
  }
});

document.querySelectorAll("[data-admin-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const selected = tab.dataset.adminTab;
    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
      button.classList.toggle("is-active", button === tab);
    });
    document.querySelectorAll("[data-admin-panel-tab]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.adminPanelTab === selected);
    });
  });
});

loadDashboard().catch(() => {});

if (window.lucide) {
  window.lucide.createIcons();
}
