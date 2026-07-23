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
const newProductButton = document.querySelector("[data-product-new]");
const productEditorTitle = document.querySelector("[data-product-editor-title]");
const productMessage = document.querySelector("[data-product-message]");
const productSizeInventory = document.querySelector("[data-product-size-inventory]");
const productSizeInventoryGrid = document.querySelector("[data-product-size-inventory-grid]");
const productSizeInventoryTotal = document.querySelector("[data-product-size-inventory-total]");
const productTotalInventoryHelp = document.querySelector("[data-product-total-inventory-help]");
const productSizeInventoryBulk = document.querySelector("[data-product-size-inventory-bulk]");
const productSizeInventoryApply = document.querySelector("[data-product-size-inventory-apply]");
const productSizeInventoryClear = document.querySelector("[data-product-size-inventory-clear]");
const productImageUpload = document.querySelector("[data-product-image-upload]");
const productImageButton = document.querySelector("[data-product-image-button]");
const productUploadCancel = document.querySelector("[data-product-upload-cancel]");
const productUploadStatus = document.querySelector("[data-product-upload-status]");
const productPreviews = document.querySelector("[data-product-previews]");
const productImageCount = document.querySelector("[data-product-image-count]");
const aiProductImage = document.querySelector("[data-ai-product-image]");
const aiProductButton = document.querySelector("[data-ai-product-button]");
const aiProductStatus = document.querySelector("[data-ai-product-status]");
const aiProductProgress = document.querySelector("[data-ai-product-progress]");
const aiProductProgressBar = document.querySelector("[data-ai-product-progress-bar]");
const aiProductProgressLabel = document.querySelector("[data-ai-product-progress-label]");
const aiProductResults = document.querySelector("[data-ai-product-results]");
const aiProductResultsCount = document.querySelector("[data-ai-product-results-count]");
const aiProductResultsTrack = document.querySelector("[data-ai-product-results-track]");
const productCropDialog = document.querySelector("[data-product-crop-dialog]");
const productCropStage = document.querySelector("[data-product-crop-stage]");
const productCropImage = document.querySelector("[data-product-crop-image]");
const productCropPreviewMedia = document.querySelector("[data-product-crop-preview-media]");
const productCropPreviewImage = document.querySelector("[data-product-crop-preview-image]");
const productCropPreviewName = document.querySelector("[data-product-crop-preview-name]");
const productCropPreviewModes = document.querySelectorAll("[data-product-crop-preview-mode]");
const productCropZoom = document.querySelector("[data-product-crop-zoom]");
const productCropX = document.querySelector("[data-product-crop-x]");
const productCropY = document.querySelector("[data-product-crop-y]");
const productCropOriginal = document.querySelector("[data-product-crop-original]");
const productCropConfirm = document.querySelector("[data-product-crop-confirm]");
let replayTimers = [];
let adminProducts = [];
let selectedProductId = "";
let cropState = null;
let cropDrag = null;
let productUploadQueue = null;
let productUploadController = null;
let productImageEntries = [];
let selectedProductImageKey = "";
let productImageKeySequence = 0;
let productImageDrag = null;
let suppressProductImageClickUntil = 0;
let productImagePositionTimer = 0;
let aiBatchResults = [];
const maximumProductImages = 15;
const maximumAiProductImages = 100;
const productUploadBatchSize = 10;
const aiProductConcurrency = 3;
const maximumProductImageBytes = 20 * 1024 * 1024;
const maximumProductUploadBatchBytes = 70 * 1024 * 1024;
const aiProductResultsStorageKey = "haller-admin-ai-product-results";
const defaultAdminProductSizes = {
  clothing: ["S", "M", "L", "XL", "XXL", "XXXL"],
  sneakers: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
  none: [],
};

function resolveAdminProductSizeType({ collection = "", category = "" } = {}) {
  const label = `${collection} ${category}`.toLocaleLowerCase("it");
  if (/\b(?:scarp[ae]|sneakers?|shoes?|boots?|stivali?)\b/u.test(label)) return "sneakers";
  if (/\b(?:bors[ae]|bag|wallet|portafogli[oa]?|card holder|backpack|zain[oi]|cintur[ae]|accessori?)\b/u.test(label)) return "none";
  return "clothing";
}

function syncAdminProductSizeTypeFromDetails() {
  if (!productForm?.elements.sizeType) return;
  const sizeType = resolveAdminProductSizeType({
    collection: productForm.elements.collection?.value,
    category: productForm.elements.category?.value,
  });
  productForm.elements.sizeType.value = sizeType;
}

function storedAiProductResultIds() {
  try {
    const ids = JSON.parse(sessionStorage.getItem(aiProductResultsStorageKey) || "[]");
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string").slice(0, maximumAiProductImages) : [];
  } catch {
    return [];
  }
}

function rememberAiProductResults(results) {
  const ids = results.map((entry) => entry.product?.id).filter(Boolean);
  try {
    sessionStorage.setItem(aiProductResultsStorageKey, JSON.stringify(ids));
  } catch {}
}

function renderAiProductResults() {
  if (!aiProductResults || !aiProductResultsTrack || !aiProductResultsCount) return;
  aiProductResults.hidden = aiBatchResults.length === 0;
  if (!aiBatchResults.length) return;

  const completed = aiBatchResults.filter((entry) => entry.status === "success").length;
  const failed = aiBatchResults.filter((entry) => entry.status === "error").length;
  aiProductResultsCount.textContent = `${completed} creati su ${aiBatchResults.length}${failed ? ` · ${failed} non riusciti` : ""}`;
  aiProductResultsTrack.innerHTML = aiBatchResults.map((entry, index) => {
    const product = entry.product;
    const image = product?.images?.[0] || "";
    if (entry.status === "success" && product) {
      return `
        <button class="ai-product-result-card is-success" type="button" data-product-id="${escapeHtml(product.id)}">
          <span class="ai-product-result-thumb">
            ${image ? `<img src="${escapeHtml(productImageUrl(image))}" alt="${escapeHtml(product.name)}" loading="lazy">` : `<i data-lucide="image"></i>`}
          </span>
          <span class="ai-product-result-copy">
            <small>Prodotto ${index + 1}</small>
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(product.brand || product.category || "Prodotto AI")}</span>
            <em>Apri e modifica</em>
          </span>
        </button>`;
    }
    if (entry.status === "error") {
      return `
        <article class="ai-product-result-card is-error">
          <span class="ai-product-result-thumb"><i data-lucide="circle-alert"></i></span>
          <span class="ai-product-result-copy">
            <small>Foto ${index + 1}</small>
            <strong>${escapeHtml(entry.fileName || "Immagine")}</strong>
            <span>${escapeHtml(entry.message || "Creazione non riuscita")}</span>
          </span>
        </article>`;
    }
    return `
      <article class="ai-product-result-card is-pending">
        <span class="ai-product-result-thumb"><i data-lucide="loader-circle"></i></span>
        <span class="ai-product-result-copy">
          <small>Foto ${index + 1}</small>
          <strong>${escapeHtml(entry.fileName || "Immagine")}</strong>
          <span>Analisi AI in corso...</span>
        </span>
      </article>`;
  }).join("");
  if (window.lucide) window.lucide.createIcons();
}

function setAdminMessage(message, type = "") {
  if (!adminMessage) return;
  adminMessage.textContent = message || "";
  adminMessage.dataset.type = type;
}

async function api(path, options = {}) {
  try {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    return await readAdminApiResponse(response, "Operazione non riuscita.");
  } catch (error) {
    if (error instanceof Error && !/fetch|network|load failed|expected pattern/i.test(error.message)) throw error;
    throw new Error("Connessione al server interrotta. Attendi qualche secondo e riprova.");
  }
}

async function uploadApi(path, body, options = {}) {
  try {
    const response = await fetch(path, { method: "POST", body, signal: options.signal });
    return await readAdminApiResponse(response, "Upload non riuscito.");
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    if (error instanceof Error && !/fetch|network|load failed|expected pattern/i.test(error.message)) throw error;
    throw new Error("Caricamento interrotto dal server. Attendi qualche secondo e riprova.");
  }
}

async function readAdminApiResponse(response, fallbackMessage) {
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(response.ok ? fallbackMessage : "Il server non ha completato la richiesta. Riprova.");
  }
  if (!response.ok || data.ok === false) throw new Error(data.message || fallbackMessage);
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

function setProductUploadActive(active) {
  if (productImageButton) productImageButton.disabled = active;
  if (productUploadCancel) productUploadCancel.hidden = !active;
  const saveButton = productForm?.querySelector('button[type="submit"]');
  if (saveButton) saveButton.disabled = active;
}

function resetProductUploadState() {
  productUploadQueue = null;
  productUploadController = null;
  setProductUploadActive(false);
  if (productImageUpload) productImageUpload.value = "";
}

function interruptProductUpload(message = "Caricamento foto interrotto.") {
  if (!productUploadQueue && !productUploadController) return;
  productUploadController?.abort();
  resetProductUploadState();
  setProductUploadStatus(message);
  setProductMessage(message);
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

function parseAdminProductPrice(value) {
  const raw = String(value || "").replace(/[^\d,.-]/g, "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const price = Number(normalized);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function parseAdminDiscountPercentage(value) {
  const match = String(value || "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const percentage = Math.abs(Number(match[0]));
  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 ? percentage : null;
}

function syncOriginalPriceFromDiscount() {
  if (!productForm) return;
  const finalPrice = parseAdminProductPrice(productForm.elements.finalPrice?.value);
  const percentage = parseAdminDiscountPercentage(productForm.elements.discount?.value);
  if (finalPrice === null || percentage === null || percentage >= 100) return;
  const originalPrice = Math.max(0, finalPrice / (1 - percentage / 100));
  productForm.elements.original.value = originalPrice.toFixed(2).replace(".", ",");
}

function productImageUrl(src) {
  const value = String(src || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function nextProductImageKey() {
  productImageKeySequence += 1;
  return `product-image-${productImageKeySequence}`;
}

function revokeProductImagePreview(entry) {
  if (entry?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(entry.previewUrl);
}

function clearProductImageEntries() {
  productImageEntries.forEach(revokeProductImagePreview);
  productImageEntries = [];
  selectedProductImageKey = "";
}

function syncProductImageFields() {
  if (!productForm) return;
  productForm.elements.images.value = productImageEntries.map((entry) => entry.image).filter(Boolean).join("\n");
  productForm.elements.originalImages.value = productImageEntries
    .filter((entry) => entry.image)
    .map((entry) => entry.originalImage || entry.image)
    .join("\n");
  productForm.elements.zoomImages.value = productImageEntries
    .filter((entry) => entry.image)
    .map((entry) => entry.zoomImage || entry.image)
    .join("\n");
  productForm.elements.imageVariant.value = productImageEntries[0]?.variant || "original";
}

function setProductImageEntries(images = [], originals = [], zoomImages = [], primaryVariant = "original", imageRenditions = {}) {
  clearProductImageEntries();
  productImageEntries = images.slice(0, maximumProductImages).map((image, index) => {
    const originalImage = originals[index] || image;
    return {
      key: nextProductImageKey(),
      image,
      originalImage,
      zoomImage: zoomImages[index] || image,
      renditions: Array.isArray(imageRenditions?.[image]) ? imageRenditions[image] : [],
      variant: index === 0 ? primaryVariant : originalImage !== image ? "cropped" : "original",
      pendingImage: null,
      originalFile: null,
      previewUrl: "",
    };
  });
  selectedProductImageKey = productImageEntries[0]?.key || "";
  syncProductImageFields();
  renderProductPreviews();
}

function renderProductPreviews() {
  if (!productPreviews) return;
  window.clearTimeout(productImagePositionTimer);
  if (productImageCount) productImageCount.textContent = `${productImageEntries.length} / ${maximumProductImages}`;
  if (!productImageEntries.length) {
    productPreviews.innerHTML = `<p class="admin-empty">Nessuna immagine caricata per questo prodotto.</p>`;
    return;
  }
  if (!productImageEntries.some((entry) => entry.key === selectedProductImageKey)) {
    selectedProductImageKey = productImageEntries[0].key;
  }
  productPreviews.innerHTML = productImageEntries
    .map(
      (entry, index) => `
        <article class="product-preview-item${entry.key === selectedProductImageKey ? " is-selected" : ""}" data-product-image-key="${entry.key}">
          <button class="product-preview-select" type="button" data-product-image-select aria-label="Seleziona foto ${index + 1}">
            <img src="${escapeHtml(entry.previewUrl || productImageUrl(entry.image))}" alt="Anteprima prodotto ${index + 1}" loading="lazy">
            <span>${index === 0 ? "Copertina" : `Foto ${index + 1}`}</span>
          </button>
          <div class="product-preview-caption">
            <strong>${index === 0 ? "Copertina" : `Foto ${index + 1}`}</strong>
            <small>${entry.pendingImage ? "Da caricare" : entry.variant === "cropped" ? "Ritagliata" : "Originale"}</small>
          </div>
          <div class="product-preview-order">
            <button class="product-preview-drag" type="button" data-product-image-drag title="Trascina per riordinare" aria-label="Trascina la foto ${index + 1} per cambiarne la posizione"><i data-lucide="grip-vertical"></i></button>
            <label>
              <span>Pos.</span>
              <input type="number" min="1" max="${productImageEntries.length}" step="1" inputmode="numeric" value="${index + 1}" data-product-image-position aria-label="Posizione della foto ${index + 1}">
            </label>
          </div>
          <div class="product-preview-actions">
            <button type="button" data-product-image-move="left" title="Sposta prima" aria-label="Sposta la foto ${index + 1} prima"${index === 0 ? " disabled" : ""}><i data-lucide="chevron-left"></i></button>
            <button type="button" data-product-image-edit title="Modifica foto" aria-label="Modifica la foto ${index + 1}"><i data-lucide="crop"></i></button>
            <button type="button" data-product-image-move="right" title="Sposta dopo" aria-label="Sposta la foto ${index + 1} dopo"${index === productImageEntries.length - 1 ? " disabled" : ""}><i data-lucide="chevron-right"></i></button>
            <button type="button" data-product-image-remove title="Rimuovi foto" aria-label="Rimuovi la foto ${index + 1}"><i data-lucide="trash-2"></i></button>
          </div>
        </article>
      `
    )
    .join("");
  if (window.lucide) window.lucide.createIcons();
}

function moveProductImageEntry(fromIndex, toIndex) {
  if (!productImageEntries.length || fromIndex < 0 || fromIndex >= productImageEntries.length) return false;
  const destination = clamp(Math.trunc(Number(toIndex)), 0, productImageEntries.length - 1);
  if (!Number.isFinite(destination) || destination === fromIndex) return false;
  const [entry] = productImageEntries.splice(fromIndex, 1);
  productImageEntries.splice(destination, 0, entry);
  selectedProductImageKey = entry.key;
  syncProductImageFields();
  renderProductPreviews();
  setProductUploadStatus("Ordine aggiornato. La foto in posizione 1 sara la copertina.");
  return true;
}

function commitProductImagePosition(positionInput) {
  window.clearTimeout(productImagePositionTimer);
  const item = positionInput?.closest("[data-product-image-key]");
  if (!positionInput || !item) return;
  const fromIndex = productImageEntries.findIndex((entry) => entry.key === item.dataset.productImageKey);
  const requestedPosition = Number.parseInt(positionInput.value, 10);
  if (fromIndex === -1 || !Number.isFinite(requestedPosition)) {
    renderProductPreviews();
    return;
  }
  if (!moveProductImageEntry(fromIndex, requestedPosition - 1)) renderProductPreviews();
}

function clearProductImageDropState() {
  productPreviews?.querySelectorAll(".is-dragging, .is-drop-target").forEach((item) => {
    item.classList.remove("is-dragging", "is-drop-target");
    delete item.dataset.dropSide;
  });
}

function startProductImageDrag(event) {
  const handle = event.target.closest("[data-product-image-drag]");
  const item = handle?.closest("[data-product-image-key]");
  if (!handle || !item || event.button !== 0 || event.isPrimary === false) return;
  productImageDrag = {
    pointerId: event.pointerId,
    key: item.dataset.productImageKey,
    startX: event.clientX,
    startY: event.clientY,
    targetKey: item.dataset.productImageKey,
    dropAfter: false,
    started: false,
    handle,
  };
  handle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function moveProductImageDrag(event) {
  if (!productImageDrag || event.pointerId !== productImageDrag.pointerId) return;
  const distance = Math.hypot(event.clientX - productImageDrag.startX, event.clientY - productImageDrag.startY);
  if (!productImageDrag.started && distance < 7) return;
  productImageDrag.started = true;
  suppressProductImageClickUntil = Date.now() + 500;
  event.preventDefault();

  const sourceItem = productPreviews?.querySelector(`[data-product-image-key="${productImageDrag.key}"]`);
  sourceItem?.classList.add("is-dragging");
  productPreviews?.querySelectorAll(".is-drop-target").forEach((item) => {
    item.classList.remove("is-drop-target");
    delete item.dataset.dropSide;
  });

  const targetItem = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-product-image-key]");
  if (!targetItem || !productPreviews?.contains(targetItem)) return;
  const bounds = targetItem.getBoundingClientRect();
  const nearMiddleRow = Math.abs(event.clientY - (bounds.top + bounds.height / 2)) < bounds.height * 0.28;
  const dropAfter = nearMiddleRow
    ? event.clientX >= bounds.left + bounds.width / 2
    : event.clientY >= bounds.top + bounds.height / 2;
  productImageDrag.targetKey = targetItem.dataset.productImageKey;
  productImageDrag.dropAfter = dropAfter;
  if (productImageDrag.targetKey !== productImageDrag.key) {
    targetItem.classList.add("is-drop-target");
    targetItem.dataset.dropSide = dropAfter ? "after" : "before";
  }
}

function finishProductImageDrag(event, cancelled = false) {
  if (!productImageDrag || event.pointerId !== productImageDrag.pointerId) return;
  const drag = productImageDrag;
  productImageDrag = null;
  try {
    if (drag.handle.hasPointerCapture?.(event.pointerId)) drag.handle.releasePointerCapture(event.pointerId);
  } catch {}

  if (!cancelled && drag.started) {
    const sourceIndex = productImageEntries.findIndex((entry) => entry.key === drag.key);
    const targetIndex = productImageEntries.findIndex((entry) => entry.key === drag.targetKey);
    if (sourceIndex !== -1 && targetIndex !== -1) {
      let destination = targetIndex + (drag.dropAfter ? 1 : 0);
      if (sourceIndex < destination) destination -= 1;
      if (moveProductImageEntry(sourceIndex, destination)) return;
    }
  }
  clearProductImageDropState();
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
  productCropPreviewName.textContent = source?.type === "gallery" && selectedName ? selectedName : "Nuovo prodotto";
}

function syncCropPositionControl(control, offset, maximum) {
  if (!control) return;
  control.disabled = maximum < 0.5;
  control.value = maximum < 0.5 ? "0" : String(Math.round((offset / maximum) * 100));
}

function positionCropImage(image, bounds, imageWidth, imageHeight, offsetX, offsetY) {
  image.style.inset = "auto";
  image.style.width = `${imageWidth}px`;
  image.style.height = `${imageHeight}px`;
  image.style.left = `${bounds.width / 2 + offsetX}px`;
  image.style.top = `${bounds.height / 2 + offsetY}px`;
  image.style.objectFit = "initial";
  image.style.transform = "translate(-50%, -50%)";
}

function updateCropPreview() {
  if (!cropState || !productCropStage || !productCropImage || !productCropPreviewMedia || !productCropPreviewImage) return;
  const stageWidth = productCropStage.clientWidth;
  const stageHeight = productCropStage.clientHeight;
  if (!stageWidth || !stageHeight || !cropState.sourceWidth || !cropState.sourceHeight) return;

  cropState.stageWidth = stageWidth;
  cropState.stageHeight = stageHeight;
  cropState.baseScale = Math.max(stageWidth / cropState.sourceWidth, stageHeight / cropState.sourceHeight);
  cropState.imageScale = cropState.baseScale * cropState.zoom;
  const imageWidth = cropState.sourceWidth * cropState.imageScale;
  const imageHeight = cropState.sourceHeight * cropState.imageScale;
  cropState.maxOffsetX = Math.max(0, (imageWidth - stageWidth) / 2);
  cropState.maxOffsetY = Math.max(0, (imageHeight - stageHeight) / 2);
  cropState.offsetX = clamp(cropState.offsetX, -cropState.maxOffsetX, cropState.maxOffsetX);
  cropState.offsetY = clamp(cropState.offsetY, -cropState.maxOffsetY, cropState.maxOffsetY);
  positionCropImage(productCropImage, { width: stageWidth, height: stageHeight }, imageWidth, imageHeight, cropState.offsetX, cropState.offsetY);
  syncCropPositionControl(productCropX, cropState.offsetX, cropState.maxOffsetX);
  syncCropPositionControl(productCropY, cropState.offsetY, cropState.maxOffsetY);

  const previewBounds = productCropPreviewMedia.getBoundingClientRect();
  if (!previewBounds.width || !previewBounds.height) return;
  if (cropState.previewMode === "original") {
    productCropPreviewImage.style.inset = "0";
    productCropPreviewImage.style.width = "100%";
    productCropPreviewImage.style.height = "100%";
    productCropPreviewImage.style.objectFit = "contain";
    productCropPreviewImage.style.transform = "none";
  } else {
    const previewScale = Math.max(previewBounds.width / stageWidth, previewBounds.height / stageHeight);
    positionCropImage(
      productCropPreviewImage,
      previewBounds,
      imageWidth * previewScale,
      imageHeight * previewScale,
      cropState.offsetX * previewScale,
      cropState.offsetY * previewScale
    );
  }
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
  if (source?.type === "ai") {
    if (aiProductImage) aiProductImage.value = "";
    setAiProductStatus("Creazione bozza annullata.");
  }
}

function openProductCropper(file, source) {
  if (!productCropDialog || !productCropImage || !productCropPreviewImage || !productCropZoom || !productCropX || !productCropY) {
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
    imageScale: 1,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    maxOffsetX: 0,
    maxOffsetY: 0,
    stageWidth: 0,
    stageHeight: 0,
    previewMode: "cropped",
  };
  productCropZoom.value = "1";
  productCropX.value = "0";
  productCropY.value = "0";
  productCropX.disabled = true;
  productCropY.disabled = true;
  productCropPreviewModes.forEach((button) => button.classList.toggle("is-active", button.dataset.productCropPreviewMode === "cropped"));
  if (productCropOriginal) {
    productCropOriginal.textContent = source.type === "ai" ? "Usa originale e crea bozza" : "Usa originale";
    productCropOriginal.disabled = true;
  }
  productCropConfirm.textContent = source.type === "ai" ? "Ritaglia e crea bozza" : "Applica ritaglio";
  productCropConfirm.disabled = true;
  refreshCropStorefrontCopy(source);
  productCropImage.src = cropState.objectUrl;
  productCropPreviewImage.src = cropState.objectUrl;
  if (typeof productCropDialog.showModal === "function") productCropDialog.showModal();
  else productCropDialog.setAttribute("open", "");
}

function createCroppedProductImage() {
  if (!cropState?.imageScale || !cropState.stageWidth || !cropState.stageHeight || !cropState.sourceWidth || !cropState.sourceHeight) {
    throw new Error("L'immagine non e ancora pronta.");
  }
  const sourceCropWidth = Math.min(cropState.sourceWidth, cropState.stageWidth / cropState.imageScale);
  const sourceCropHeight = Math.min(cropState.sourceHeight, cropState.stageHeight / cropState.imageScale);
  const sourceX = clamp(
    (cropState.sourceWidth - sourceCropWidth) / 2 - cropState.offsetX / cropState.imageScale,
    0,
    cropState.sourceWidth - sourceCropWidth
  );
  const sourceY = clamp(
    (cropState.sourceHeight - sourceCropHeight) / 2 - cropState.offsetY / cropState.imageScale,
    0,
    cropState.sourceHeight - sourceCropHeight
  );
  const outputWidth = Math.max(1, Math.round(sourceCropWidth));
  const outputHeight = Math.max(1, Math.round(sourceCropHeight));
  const sourceFile = cropState.file;
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossibile preparare il ritaglio.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    productCropImage,
    sourceX,
    sourceY,
    sourceCropWidth,
    sourceCropHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );
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
      1
    );
  });
}

async function uploadProductImages(entries, productId, { signal } = {}) {
  const formData = new FormData();
  formData.append("productId", productId);
  formData.append("makePrimary", "no");
  const imageVariants = [];
  const originalImageIndexes = [];
  entries.forEach((entry, index) => {
    const file = entry.image?.blob || entry.image;
    const filename = entry.image?.name || `prodotto-${index + 1}.jpg`;
    formData.append("images", file, filename);
    imageVariants.push(entry.variant);
    if (entry.variant === "cropped" && entry.originalFile) {
      originalImageIndexes.push(index);
      formData.append("originalImage", entry.originalFile, entry.originalFile.name || `prodotto-originale-${index + 1}.jpg`);
    }
  });
  formData.append("imageVariants", JSON.stringify(imageVariants));
  formData.append("originalImageIndexes", JSON.stringify(originalImageIndexes));
  formData.append("imageVariant", imageVariants[0] || "original");
  return uploadApi("/api/admin/product-images", formData, { signal });
}

async function createAiProductFromImage(image, { originalFile, variant = "original" } = {}) {
  const formData = new FormData();
  formData.append("image", image.blob, image.name);
  formData.append("imageVariant", variant);
  if (variant === "cropped" && originalFile) {
    formData.append("sourceImage", originalFile, originalFile.name || "prodotto-originale.jpg");
  }
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
      originalImages: data.suggestion?.originalImages || (data.originalImage ? [data.originalImage] : []),
      zoomImages: data.suggestion?.zoomImages || (data.zoomImage ? [data.zoomImage] : []),
      imageRenditions: data.suggestion?.imageRenditions || {},
      imageVariant: data.suggestion?.imageVariant || variant,
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

async function analyzeAndSaveAiProductFile(file) {
  const formData = new FormData();
  formData.append("image", file, file.name);
  formData.append("imageVariant", "original");
  const data = await uploadApi("/api/admin/ai-product", formData);
  const suggestion = data.suggestion || {};
  const images = Array.isArray(suggestion.images) && suggestion.images.length
    ? suggestion.images
    : data.image ? [data.image] : [];
  if (!images.length) throw new Error("L'AI non ha restituito l'immagine prodotto.");

  const payload = {
    name: suggestion.name || "Prodotto",
    brand: suggestion.brand || "",
    description: suggestion.description || "",
    collection: suggestion.collection || "Selezione Haller Boutique",
    category: suggestion.category || "",
    original: "",
    finalPrice: "",
    discount: "",
    sizeType: suggestion.sizeType || "none",
    sizes: Array.isArray(suggestion.sizes) ? suggestion.sizes : [],
    inventory: "",
    inventoryBySize: {},
    images,
    originalImages: Array.isArray(suggestion.originalImages) && suggestion.originalImages.length
      ? suggestion.originalImages
      : data.originalImage ? [data.originalImage] : images,
    zoomImages: Array.isArray(suggestion.zoomImages) && suggestion.zoomImages.length
      ? suggestion.zoomImages
      : data.zoomImage ? [data.zoomImage] : images,
    imageRenditions: suggestion.imageRenditions || {},
    imageVariant: suggestion.imageVariant || "original",
  };
  const saved = await api("/api/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return saved.product;
}

async function createAiProductFromFiles(files) {
  const selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) return;
  if (selectedFiles.length > maximumAiProductImages) {
    throw new Error(`Puoi creare fino a ${maximumAiProductImages} prodotti alla volta.`);
  }
  if (selectedFiles.some((file) => !file.type.startsWith("image/") || !file.size || file.size > maximumProductImageBytes)) {
    throw new Error("Usa immagini JPG, PNG o WebP fino a 20 MB ciascuna.");
  }

  const createdProducts = [];
  const failedProducts = [];
  aiBatchResults = selectedFiles.map((file) => ({ fileName: file.name, status: "pending", product: null, message: "" }));
  renderAiProductResults();
  let nextFileIndex = 0;
  let completedCount = 0;
  aiProductButton.disabled = true;
  setAiProductProgress(1, `Avvio analisi AI di ${selectedFiles.length} immagini`);
  setAiProductStatus(`L'AI sta creando ${selectedFiles.length} prodotti distinti...`);
  setProductMessage("");

  try {
    const worker = async () => {
      while (nextFileIndex < selectedFiles.length) {
        const fileIndex = nextFileIndex;
        nextFileIndex += 1;
        const file = selectedFiles[fileIndex];
        try {
          const product = await analyzeAndSaveAiProductFile(file);
          if (product) {
            createdProducts.push(product);
            aiBatchResults[fileIndex] = { fileName: file.name, status: "success", product, message: "" };
          }
        } catch (error) {
          failedProducts.push({ file: file.name, message: error.message });
          aiBatchResults[fileIndex] = { fileName: file.name, status: "error", product: null, message: error.message };
        } finally {
          renderAiProductResults();
          completedCount += 1;
          const message = `Analisi AI ${completedCount} di ${selectedFiles.length} · ${createdProducts.length} prodotti creati`;
          setAiProductProgress((completedCount / selectedFiles.length) * 100, message);
          setAiProductStatus(message);
        }
      }
    };
    const workers = Array.from(
      { length: Math.min(aiProductConcurrency, selectedFiles.length) },
      () => worker()
    );
    await Promise.all(workers);

    if (!createdProducts.length) {
      throw new Error(failedProducts[0]?.message || "L'AI non ha creato nessun prodotto.");
    }
    selectedProductId = createdProducts[createdProducts.length - 1].id;
    await loadProducts();
    rememberAiProductResults(aiBatchResults);
    renderAiProductResults();
    const summary = failedProducts.length
      ? `${createdProducts.length} prodotti creati, ${failedProducts.length} non riusciti.`
      : `${createdProducts.length} prodotti creati con AI.`;
    setAiProductProgress(100, summary, failedProducts.length ? "error" : "success");
    setAiProductStatus(summary, failedProducts.length ? "error" : "success");
    setProductMessage("I prodotti creati sono nel catalogo e restano modificabili.", "success");
  } catch (error) {
    setAiProductProgress(100, "Analisi non riuscita", "error");
    setAiProductStatus(error.message, "error");
    setProductMessage(error.message, "error");
  } finally {
    aiProductButton.disabled = false;
    aiProductImage.value = "";
  }
}

async function handleSelectedProductImage(image, source, variant) {
  if (source.type === "ai") {
    await createAiProductFromImage(image, { originalFile: cropState?.file || source.originalFile, variant });
    return;
  }

  if (source.type !== "gallery") return;
  const entry = productImageEntries.find((item) => item.key === source.entryKey);
  if (!entry) return;
  revokeProductImagePreview(entry);
  entry.pendingImage = image;
  entry.originalFile = source.originalFile;
  entry.renditions = [];
  entry.variant = variant;
  entry.previewUrl = URL.createObjectURL(image.blob || image);
  selectedProductImageKey = entry.key;
  syncProductImageFields();
  renderProductPreviews();
  setProductUploadStatus("Modifica pronta. Salva il prodotto per pubblicarla.");
  setProductMessage("Immagine modificata nella galleria.", "success");
}

async function uploadPendingProductImages(productId) {
  const pendingEntries = productImageEntries.filter((entry) => entry.pendingImage);
  if (!pendingEntries.length) return;
  productUploadController?.abort();
  productUploadController = new AbortController();
  productUploadQueue = { productId, entries: pendingEntries };
  setProductUploadActive(true);

  const batches = [];
  pendingEntries.forEach((entry) => {
    const uploadBytes = Number(entry.pendingImage?.blob?.size || entry.pendingImage?.size || 0)
      + (entry.variant === "cropped" ? Number(entry.originalFile?.size || 0) : 0);
    let batch = batches[batches.length - 1];
    const batchBytes = batch?.reduce((total, item) => {
      return total + Number(item.pendingImage?.blob?.size || item.pendingImage?.size || 0)
        + (item.variant === "cropped" ? Number(item.originalFile?.size || 0) : 0);
    }, 0) || 0;
    if (!batch || batch.length >= productUploadBatchSize || batchBytes + uploadBytes > maximumProductUploadBatchBytes) {
      batch = [];
      batches.push(batch);
    }
    batch.push(entry);
  });

  let uploadedCount = 0;
  for (const batch of batches) {
    if (!productUploadQueue) throw new DOMException("Upload interrotto", "AbortError");
    setProductUploadStatus(`Caricamento foto ${uploadedCount + 1}-${uploadedCount + batch.length} di ${pendingEntries.length}...`);
    const data = await uploadProductImages(
      batch.map((entry) => ({ image: entry.pendingImage, originalFile: entry.originalFile, variant: entry.variant })),
      productId,
      { signal: productUploadController.signal }
    );
    if (!Array.isArray(data.images) || data.images.length !== batch.length) {
      throw new Error("Il server non ha salvato tutte le immagini.");
    }
    batch.forEach((entry, index) => {
      revokeProductImagePreview(entry);
      entry.image = data.images[index];
      entry.originalImage = data.originalImages?.[index] || data.images[index];
      entry.zoomImage = data.zoomImages?.[index] || data.images[index];
      entry.renditions = data.imageRenditions?.[entry.image] || [];
      entry.pendingImage = null;
      entry.originalFile = null;
      entry.previewUrl = "";
    });
    syncProductImageFields();
    renderProductPreviews();
    uploadedCount += batch.length;
  }
}

async function editProductImageEntry(entry) {
  if (!entry) return;
  selectedProductImageKey = entry.key;
  renderProductPreviews();
  let sourceFile = entry.originalFile;
  if (!sourceFile) {
    const sourceUrl = productImageUrl(entry.originalImage || entry.image);
    if (!sourceUrl) throw new Error("Immagine originale non disponibile.");
    setProductUploadStatus("Apertura immagine selezionata...");
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error("Impossibile aprire questa immagine.");
    const blob = await response.blob();
    const filename = sourceUrl.split("/").pop()?.split("?")[0] || "prodotto.jpg";
    sourceFile = new File([blob], filename, { type: blob.type || "image/jpeg" });
  }
  openProductCropper(sourceFile, {
    type: "gallery",
    productId: productForm?.elements.id.value || "",
    entryKey: entry.key,
  });
}

function addProductImageFiles(files) {
  const remaining = Math.max(0, maximumProductImages - productImageEntries.length);
  const validFiles = files.filter((file) => file.type.startsWith("image/") && file.size > 0 && file.size <= maximumProductImageBytes);
  const accepted = validFiles.slice(0, remaining);
  if (!accepted.length) {
    throw new Error(remaining ? "Usa immagini JPG, PNG o WebP fino a 20 MB ciascuna." : `La galleria contiene gia ${maximumProductImages} foto.`);
  }
  const newEntries = accepted.map((file) => ({
    key: nextProductImageKey(),
    image: "",
    originalImage: "",
    renditions: [],
    variant: "original",
    pendingImage: { blob: file, name: file.name },
    originalFile: file,
    previewUrl: URL.createObjectURL(file),
  }));
  productImageEntries.push(...newEntries);
  selectedProductImageKey = newEntries[0].key;
  syncProductImageFields();
  renderProductPreviews();
  const skipped = files.length - accepted.length;
  setProductUploadStatus(`${accepted.length} foto aggiunte${skipped ? `, ${skipped} non aggiunte per formato, dimensione o limite` : ""}.`);
  setProductMessage("Galleria pronta da ordinare e modificare.", "success");
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

function parseAdminInventoryBySize(value) {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = {};
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([size, quantity]) => [String(size).trim(), Number(quantity)])
      .filter(([size, quantity]) => size && Number.isInteger(quantity) && quantity >= 0)
  );
}

function adminProductSizes() {
  const explicitSizes = String(productForm?.elements.sizes?.value || "")
    .split(/[\n,;]+/)
    .map((size) => size.trim())
    .filter(Boolean);
  if (explicitSizes.length) return [...new Set(explicitSizes)].slice(0, 20);
  const sizeType = resolveAdminProductSizeType({
    collection: productForm?.elements.collection?.value,
    category: productForm?.elements.category?.value,
  });
  return defaultAdminProductSizes[sizeType] || [];
}

function readProductSizeInventoryEditor() {
  if (!productSizeInventoryGrid) return {};
  return Object.fromEntries(
    [...productSizeInventoryGrid.querySelectorAll("[data-product-size-inventory-input]")]
      .map((input) => [input.dataset.productSizeInventoryInput || "", input.value])
      .filter(([size, value]) => size && value !== "")
      .map(([size, value]) => [size, Math.max(0, Number.parseInt(value, 10) || 0)])
  );
}

function syncProductSizeInventory() {
  if (!productForm) return {};
  const inventoryBySize = readProductSizeInventoryEditor();
  const entries = Object.entries(inventoryBySize);
  const totalInput = productForm.elements.inventory;
  productForm.elements.inventoryBySize.value = JSON.stringify(inventoryBySize);

  if (productSizeInventoryTotal) {
    const total = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
    productSizeInventoryTotal.textContent = entries.length ? `Totale: ${total}` : "Totale non definito";
    if (entries.length && totalInput) totalInput.value = String(total);
  }
  if (totalInput) totalInput.readOnly = entries.length > 0;
  if (productTotalInventoryHelp) {
    productTotalInventoryHelp.textContent = entries.length
      ? "Calcolato automaticamente dalla disponibilità delle taglie."
      : "Usato per prodotti senza taglie o finché le quantità per taglia non sono definite.";
  }
  return inventoryBySize;
}

function productSizeInventoryInputs() {
  return productSizeInventoryGrid
    ? [...productSizeInventoryGrid.querySelectorAll("[data-product-size-inventory-input]")]
    : [];
}

function setAllProductSizeInventory(quantity) {
  const normalized = Math.max(0, Number.parseInt(quantity, 10) || 0);
  productSizeInventoryInputs().forEach((input) => {
    input.value = String(normalized);
  });
  syncProductSizeInventory();
}

function renderProductSizeInventory(value = null) {
  if (!productForm || !productSizeInventory || !productSizeInventoryGrid) return;
  const sizes = adminProductSizes();
  const inventoryBySize = value === null
    ? readProductSizeInventoryEditor()
    : parseAdminInventoryBySize(value);
  productSizeInventory.hidden = sizes.length === 0;
  productSizeInventoryGrid.innerHTML = sizes.map((size) => {
    const quantity = Number.isInteger(inventoryBySize[size]) ? String(inventoryBySize[size]) : "";
    return `
      <div class="product-size-inventory-field">
        <span>Taglia ${escapeHtml(size)}</span>
        <div class="product-size-inventory-stepper">
          <button type="button" data-product-size-inventory-step="-1" data-product-size-inventory-size="${escapeHtml(size)}" aria-label="Diminuisci quantità taglia ${escapeHtml(size)}">−</button>
          <input type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(quantity)}" data-product-size-inventory-input="${escapeHtml(size)}" aria-label="Inventario taglia ${escapeHtml(size)}" placeholder="0">
          <button type="button" data-product-size-inventory-step="1" data-product-size-inventory-size="${escapeHtml(size)}" aria-label="Aumenta quantità taglia ${escapeHtml(size)}">+</button>
        </div>
      </div>
    `;
  }).join("");
  syncProductSizeInventory();
}

function adminInventorySummary(product) {
  const inventoryBySize = parseAdminInventoryBySize(product?.inventoryBySize);
  const entries = Object.entries(inventoryBySize);
  if (entries.length) {
    const total = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
    return `${total} totali · ${entries.map(([size, quantity]) => `${size}: ${quantity}`).join(" · ")}`;
  }
  return Number.isInteger(product?.inventory) ? `${product.inventory} in inventario` : "inventario da definire";
}

function fillProductForm(product) {
  if (!productForm || !product) return;
  if (productEditorTitle) productEditorTitle.textContent = "Modifica prodotto";
  selectedProductId = product.id;
  productForm.elements.id.value = product.id;
  productForm.elements.name.value = product.name || "";
  productForm.elements.brand.value = product.brand || "";
  productForm.elements.collection.value = product.collection || "";
  productForm.elements.category.value = product.category || "";
  if (productForm.elements.description) productForm.elements.description.value = product.description || "";
  productForm.elements.original.value = formatAdminProductPrice(product.original);
  productForm.elements.finalPrice.value = formatAdminProductPrice(product.finalPrice);
  productForm.elements.discount.value = product.discount || "";
  syncAdminProductSizeTypeFromDetails();
  productForm.elements.sizes.value = Array.isArray(product.sizes) ? product.sizes.join(", ") : "";
  productForm.elements.inventory.value = Number.isInteger(product.inventory) ? String(product.inventory) : "";
  productForm.elements.inventoryBySize.value = JSON.stringify(parseAdminInventoryBySize(product.inventoryBySize));
  renderProductSizeInventory(product.inventoryBySize);
  setProductImageEntries(
    product.images || [],
    product.originalImages || product.images || [],
    product.zoomImages || product.images || [],
    product.imageVariant || "original",
    product.imageRenditions || {}
  );
  setProductMessage("");
  renderAdminProducts();
}

function fillAiProductDraft(suggestion) {
  if (!productForm || !suggestion) return;
  if (productEditorTitle) productEditorTitle.textContent = "Nuovo prodotto";
  selectedProductId = "";
  productForm.elements.id.value = "";
  productForm.elements.name.value = suggestion.name || "";
  productForm.elements.brand.value = suggestion.brand || "";
  productForm.elements.collection.value = suggestion.collection || "Selezione Haller Boutique";
  productForm.elements.category.value = suggestion.category || "";
  if (productForm.elements.description) productForm.elements.description.value = suggestion.description || "";
  productForm.elements.original.value = "";
  productForm.elements.finalPrice.value = "";
  productForm.elements.discount.value = "";
  syncAdminProductSizeTypeFromDetails();
  productForm.elements.sizes.value = Array.isArray(suggestion.sizes) ? suggestion.sizes.join(", ") : "";
  productForm.elements.inventory.value = "";
  productForm.elements.inventoryBySize.value = "{}";
  renderProductSizeInventory({});
  setProductImageEntries(
    suggestion.images || [],
    suggestion.originalImages || suggestion.images || [],
    suggestion.zoomImages || suggestion.images || [],
    suggestion.imageVariant || "original",
    suggestion.imageRenditions || {}
  );
  renderAdminProducts();
}

function startNewProduct() {
  if (!productForm) return;
  interruptProductUpload();
  selectedProductId = "";
  productForm.reset();
  productForm.elements.id.value = "";
  productForm.elements.originalImages.value = "";
  productForm.elements.zoomImages.value = "";
  productForm.elements.imageVariant.value = "original";
  productForm.elements.sizeType.value = "clothing";
  productForm.elements.inventoryBySize.value = "{}";
  renderProductSizeInventory({});
  setProductImageEntries([], [], [], "original", {});
  if (productEditorTitle) productEditorTitle.textContent = "Nuovo prodotto";
  setProductMessage("Compila tutti i dati: marca, collezione e categoria possono essere nuove.");
  setProductUploadStatus("Puoi selezionare fino a 15 foto: vengono caricate in gruppi di massimo 10.");
  renderAdminProducts();
  productForm.elements.name.focus();
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateProductSuggestions() {
  const fields = [
    ["product-brands", "brand"],
    ["product-collections", "collection"],
    ["product-categories", "category"],
  ];
  fields.forEach(([id, key]) => {
    const list = document.getElementById(id);
    if (!list) return;
    const values = [...new Set(adminProducts.map((product) => String(product[key] || "").trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "it"));
    list.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
  });
}

function filteredAdminProducts() {
  const query = (productSearch?.value || "").trim().toLowerCase();
  if (!query) return [];
  const score = (product) => {
    const name = String(product.name || "").toLowerCase();
    if (name === query) return 0;
    if (name.startsWith(query)) return 1;
    return 2;
  };
  return adminProducts
    .filter((product) =>
      [product.name, product.brand, product.collection, product.category, product.discount]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    )
    .sort((left, right) => score(left) - score(right) || String(left.name).localeCompare(String(right.name), "it"))
    .slice(0, 1);
}

function renderAdminProducts() {
  if (!adminProductsRoot) return;
  const query = (productSearch?.value || "").trim();
  if (!query) {
    adminProductsRoot.innerHTML = emptyState("Cerca un prodotto per visualizzare una sola anteprima.");
    return;
  }
  const products = filteredAdminProducts();
  if (products.length === 0) {
    adminProductsRoot.innerHTML = emptyState("Nessun prodotto trovato.");
    return;
  }
  const product = products[0];
  const image = Array.isArray(product.images) && product.images.length ? product.images[0] : "";
  adminProductsRoot.innerHTML = `
    <p class="admin-product-search-result">Anteprima del prodotto cercato</p>
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
        <span>${escapeHtml(product.brand || "Marca non indicata")} · ${escapeHtml(product.collection)} · ${escapeHtml(product.category)}</span>
        <small>${escapeHtml(product.original)} → ${escapeHtml(product.finalPrice)} · ${escapeHtml(product.discount)} · ${escapeHtml(product.sizeType)} · ${escapeHtml(adminInventorySummary(product))}${product.custom ? " · custom" : ""}</small>
      </span>
    </button>
  `;
  if (window.lucide) window.lucide.createIcons();
}

async function loadProducts() {
  const data = await api("/api/admin/products");
  adminProducts = data.products || [];
  if (!aiBatchResults.length) {
    aiBatchResults = storedAiProductResultIds()
      .map((id) => adminProducts.find((product) => product.id === id))
      .filter(Boolean)
      .map((product) => ({ fileName: "", status: "success", product, message: "" }));
  } else {
    aiBatchResults = aiBatchResults.map((entry) => {
      if (entry.status !== "success" || !entry.product?.id) return entry;
      return { ...entry, product: adminProducts.find((product) => product.id === entry.product.id) || entry.product };
    });
  }
  updateProductSuggestions();
  renderAdminProducts();
  renderAiProductResults();
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

productPreviews?.addEventListener("click", async (event) => {
  if (Date.now() < suppressProductImageClickUntil && event.target.closest("[data-product-image-drag]")) {
    event.preventDefault();
    return;
  }
  if (event.target.closest("[data-product-image-drag], [data-product-image-position]")) return;
  const item = event.target.closest("[data-product-image-key]");
  if (!item) return;
  const index = productImageEntries.findIndex((entry) => entry.key === item.dataset.productImageKey);
  if (index === -1) return;
  const entry = productImageEntries[index];
  selectedProductImageKey = entry.key;

  if (event.target.closest("[data-product-image-remove]")) {
    revokeProductImagePreview(entry);
    productImageEntries.splice(index, 1);
    selectedProductImageKey = productImageEntries[Math.min(index, productImageEntries.length - 1)]?.key || "";
    syncProductImageFields();
    renderProductPreviews();
    setProductUploadStatus("Foto rimossa dalla galleria. Salva il prodotto per confermare.");
    return;
  }

  const moveButton = event.target.closest("[data-product-image-move]");
  if (moveButton) {
    const nextIndex = moveButton.dataset.productImageMove === "left" ? index - 1 : index + 1;
    moveProductImageEntry(index, nextIndex);
    return;
  }

  if (event.target.closest("[data-product-image-edit]")) {
    try {
      await editProductImageEntry(entry);
    } catch (error) {
      setProductUploadStatus(error.message);
      setProductMessage(error.message, "error");
    }
    return;
  }

  renderProductPreviews();
});

productPreviews?.addEventListener("change", (event) => {
  const positionInput = event.target.closest("[data-product-image-position]");
  if (positionInput) commitProductImagePosition(positionInput);
});

productPreviews?.addEventListener("input", (event) => {
  const positionInput = event.target.closest("[data-product-image-position]");
  window.clearTimeout(productImagePositionTimer);
  if (!positionInput || !Number.isFinite(Number.parseInt(positionInput.value, 10))) return;
  productImagePositionTimer = window.setTimeout(() => commitProductImagePosition(positionInput), 450);
});

productPreviews?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("[data-product-image-position]")) {
    event.preventDefault();
    commitProductImagePosition(event.target);
  }
});

productPreviews?.addEventListener("pointerdown", startProductImageDrag);
productPreviews?.addEventListener("pointermove", moveProductImageDrag);
productPreviews?.addEventListener("pointerup", finishProductImageDrag);
productPreviews?.addEventListener("pointercancel", (event) => finishProductImageDrag(event, true));

productCropImage?.addEventListener("load", () => {
  if (!cropState) return;
  cropState.sourceWidth = productCropImage.naturalWidth;
  cropState.sourceHeight = productCropImage.naturalHeight;
  if (productCropOriginal) productCropOriginal.disabled = false;
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

productCropPreviewModes.forEach((button) => {
  button.addEventListener("click", () => {
    if (!cropState) return;
    cropState.previewMode = button.dataset.productCropPreviewMode === "original" ? "original" : "cropped";
    productCropPreviewModes.forEach((option) => option.classList.toggle("is-active", option === button));
    updateCropPreview();
  });
});

productCropZoom?.addEventListener("input", () => {
  if (!cropState) return;
  const horizontalPosition = cropState.maxOffsetX ? cropState.offsetX / cropState.maxOffsetX : 0;
  const verticalPosition = cropState.maxOffsetY ? cropState.offsetY / cropState.maxOffsetY : 0;
  cropState.zoom = clamp(Number(productCropZoom.value) || 1, 1, 3);
  updateCropPreview();
  cropState.offsetX = horizontalPosition * cropState.maxOffsetX;
  cropState.offsetY = verticalPosition * cropState.maxOffsetY;
  updateCropPreview();
});

productCropX?.addEventListener("input", () => {
  if (!cropState) return;
  cropState.offsetX = (Number(productCropX.value) / 100) * cropState.maxOffsetX;
  updateCropPreview();
});

productCropY?.addEventListener("input", () => {
  if (!cropState) return;
  cropState.offsetY = (Number(productCropY.value) / 100) * cropState.maxOffsetY;
  updateCropPreview();
});

productCropStage?.addEventListener("pointerdown", (event) => {
  if (!cropState || event.button !== 0) return;
  cropDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startOffsetX: cropState.offsetX,
    startOffsetY: cropState.offsetY,
  };
  productCropStage.classList.add("is-dragging");
  productCropStage.setPointerCapture?.(event.pointerId);
  event.preventDefault();
});

productCropStage?.addEventListener("pointermove", (event) => {
  if (!cropState || !cropDrag || cropDrag.pointerId !== event.pointerId) return;
  cropState.offsetX = cropDrag.startOffsetX + event.clientX - cropDrag.startX;
  cropState.offsetY = cropDrag.startOffsetY + event.clientY - cropDrag.startY;
  updateCropPreview();
  event.preventDefault();
});

function finishCropDrag(event) {
  if (!cropDrag || cropDrag.pointerId !== event.pointerId) return;
  cropDrag = null;
  productCropStage?.classList.remove("is-dragging");
  updateCropPreview();
}

productCropStage?.addEventListener("pointerup", finishCropDrag);
productCropStage?.addEventListener("pointercancel", finishCropDrag);
productCropStage?.addEventListener("lostpointercapture", finishCropDrag);

productCropStage?.addEventListener("keydown", (event) => {
  if (!cropState || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  const step = event.shiftKey ? 24 : 6;
  if (event.key === "ArrowLeft") cropState.offsetX -= step;
  if (event.key === "ArrowRight") cropState.offsetX += step;
  if (event.key === "ArrowUp") cropState.offsetY -= step;
  if (event.key === "ArrowDown") cropState.offsetY += step;
  updateCropPreview();
  event.preventDefault();
});

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
  if (productCropOriginal) productCropOriginal.disabled = true;
  productCropConfirm.disabled = true;
  const source = { ...cropState.source, originalFile: cropState.file };
  try {
    const croppedImage = await createCroppedProductImage();
    closeProductCropper();
    await handleSelectedProductImage(croppedImage, source, "cropped");
  } catch (error) {
    if (source.type === "ai") setAiProductStatus(error.message, "error");
    else setProductUploadStatus(error.message);
    if (productCropOriginal) productCropOriginal.disabled = false;
    productCropConfirm.disabled = false;
  }
});

productCropOriginal?.addEventListener("click", async () => {
  if (!cropState) return;
  productCropOriginal.disabled = true;
  if (productCropConfirm) productCropConfirm.disabled = true;
  const originalFile = cropState.file;
  const source = { ...cropState.source, originalFile };
  try {
    closeProductCropper();
    await handleSelectedProductImage({ blob: originalFile, name: originalFile.name }, source, "original");
  } catch (error) {
    if (source.type === "ai") setAiProductStatus(error.message, "error");
    else setProductUploadStatus(error.message);
  }
});

productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setProductMessage("Salvataggio in corso...");
  let productId = productForm.elements.id.value;
  try {
    syncProductSizeInventory();
    const pendingImages = productImageEntries.some((entry) => entry.pendingImage);
    if (pendingImages && !productId) {
      const initialPayload = Object.fromEntries(new FormData(productForm));
      initialPayload.images = [];
      initialPayload.originalImages = [];
      initialPayload.zoomImages = [];
      initialPayload.imageRenditions = {};
      const created = await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(initialPayload),
      });
      productId = created.product?.id || "";
      if (!productId) throw new Error("Creazione del prodotto non riuscita.");
      productForm.elements.id.value = productId;
      selectedProductId = productId;
    }
    if (pendingImages) {
      await uploadPendingProductImages(productId);
    }
    syncProductImageFields();
    syncProductSizeInventory();
    const payload = Object.fromEntries(new FormData(productForm));
    payload.images = productImageEntries.map((entry) => entry.image).filter(Boolean);
    payload.originalImages = productImageEntries
      .filter((entry) => entry.image)
      .map((entry) => entry.originalImage || entry.image);
    payload.zoomImages = productImageEntries
      .filter((entry) => entry.image)
      .map((entry) => entry.zoomImage || entry.image);
    payload.imageRenditions = Object.fromEntries(
      productImageEntries
        .filter((entry) => entry.image && entry.renditions.length)
        .map((entry) => [entry.image, entry.renditions])
    );
    payload.imageVariant = productImageEntries[0]?.variant || "original";
    const data = await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    selectedProductId = data.product?.id || payload.id;
    await loadProducts();
    const product = adminProducts.find((entry) => entry.id === selectedProductId);
    if (product) fillProductForm(product);
    setProductUploadStatus(`${productImageEntries.length} foto salvate nell'ordine mostrato.`);
    setProductMessage("Prodotto salvato.", "success");
  } catch (error) {
    if (error.name !== "AbortError") setProductMessage(error.message, "error");
  } finally {
    resetProductUploadState();
  }
});

productForm?.elements.sizes?.addEventListener("input", () => renderProductSizeInventory());
productForm?.elements.sizeType?.addEventListener("change", () => {
  syncAdminProductSizeTypeFromDetails();
  renderProductSizeInventory();
});
productForm?.elements.collection?.addEventListener("input", () => {
  syncAdminProductSizeTypeFromDetails();
  renderProductSizeInventory();
});
productForm?.elements.category?.addEventListener("input", () => {
  syncAdminProductSizeTypeFromDetails();
  renderProductSizeInventory();
});
productForm?.elements.finalPrice?.addEventListener("input", syncOriginalPriceFromDiscount);
productForm?.elements.discount?.addEventListener("input", syncOriginalPriceFromDiscount);
productSizeInventoryGrid?.addEventListener("input", syncProductSizeInventory);
productSizeInventoryGrid?.addEventListener("click", (event) => {
  const control = event.target.closest("[data-product-size-inventory-step]");
  if (!control) return;
  const size = control.dataset.productSizeInventorySize || "";
  const input = productSizeInventoryInputs().find((entry) => entry.dataset.productSizeInventoryInput === size);
  if (!input) return;
  const step = Number.parseInt(control.dataset.productSizeInventoryStep || "0", 10) || 0;
  input.value = String(Math.max(0, (Number.parseInt(input.value, 10) || 0) + step));
  syncProductSizeInventory();
});
productSizeInventoryApply?.addEventListener("click", () => {
  const quantity = Number.parseInt(productSizeInventoryBulk?.value || "", 10);
  if (!Number.isInteger(quantity) || quantity < 0) {
    productSizeInventoryBulk?.focus();
    return;
  }
  setAllProductSizeInventory(quantity);
});
productSizeInventoryClear?.addEventListener("click", () => {
  setAllProductSizeInventory(0);
  if (productSizeInventoryBulk) productSizeInventoryBulk.value = "";
});

newProductButton?.addEventListener("click", startNewProduct);

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
  productImageUpload?.click();
});

productUploadCancel?.addEventListener("click", () => {
  interruptProductUpload();
});

productImageUpload?.addEventListener("change", () => {
  const files = [...(productImageUpload.files || [])];
  if (files.length === 0) return;
  try {
    addProductImageFiles(files);
  } catch (error) {
    setProductUploadStatus(error.message);
    setProductMessage(error.message, "error");
  } finally {
    productImageUpload.value = "";
  }
});

aiProductButton?.addEventListener("click", () => {
  aiProductImage?.click();
});

aiProductImage?.addEventListener("change", async () => {
  const files = Array.from(aiProductImage.files || []);
  if (!files.length) return;
  try {
    if (files.length === 1) {
      openProductCropper(files[0], { type: "ai" });
      return;
    }
    await createAiProductFromFiles(files);
  } catch (error) {
    setAiProductStatus(error.message, "error");
    aiProductImage.value = "";
  }
});

document.querySelectorAll("[data-ai-products-scroll]").forEach((button) => {
  button.addEventListener("click", () => {
    const direction = Number(button.dataset.aiProductsScroll) || 1;
    const distance = Math.max(280, (aiProductResultsTrack?.clientWidth || 320) * 0.82);
    aiProductResultsTrack?.scrollBy({ left: direction * distance, behavior: "smooth" });
  });
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
