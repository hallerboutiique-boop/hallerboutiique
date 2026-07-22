import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const storefrontHtmlFiles = ["index.html", "account.html", "checkout.html", "ultimi-disponibili.html", "product.html", "spedizioni.html", "termini.html", "privacy.html"];

test("one language controller owns every picker", async () => {
  const [i18n, script] = await Promise.all([readFile("i18n.js", "utf8"), readFile("script.js", "utf8")]);
  assert.match(i18n, /picker\.dataset\.i18nBound = "true"/);
  assert.match(i18n, /ro: "Română"/);
  assert.match(i18n, /sq: "Shqip"/);
  assert.match(i18n, /ro: "🇷🇴"/);
  assert.match(i18n, /sq: "🇦🇱"/);
  assert.match(i18n, /menu\.append\(option\)/);
  assert.match(script, /window\.addEventListener\("haller-language-change"/);
  assert.doesNotMatch(script, /languageToggle\.addEventListener/);
});

test("Aurora sends and enforces the selected language", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.match(script, /language: siteLanguage/);
  assert.match(server, /const siteChatLanguages = \{/);
  assert.match(server, /Rispondi esclusivamente in \$\{languageConfig\.name\}/);
  assert.doesNotMatch(server, /Scrivi in italiano, con tono caldo/);
  for (const language of ["it", "en", "fr", "de", "es", "ro", "sq"]) {
    assert.match(server, new RegExp(`\\n  ${language}: \\{ name:`));
  }
});

test("action-only UI and try-on use the selected language", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.match(script, /formData\.append\("language", siteLanguage\)/);
  assert.match(script, /translate\("location-authorize"\)/);
  assert.match(script, /translate\("confirming-order"\)/);
  assert.match(server, /const tryOnLanguages = \{/);
});

test("all pages use the cache-busted unified language script", async () => {
  for (const file of storefrontHtmlFiles) {
    const html = await readFile(file, "utf8");
    assert.match(html, /i18n\.js\?v=restore-latest-ui-1/, file);
  }
  const admin = await readFile("admin.html", "utf8");
  assert.match(admin, /i18n\.js\?v=admin-products-2/);
});

test("checkout exposes a multilingual bundle try-on", async () => {
  const [checkout, script] = await Promise.all([readFile("checkout.html", "utf8"), readFile("script.js", "utf8")]);
  assert.match(checkout, /data-bundle-tryon/);
  assert.match(checkout, /\/assets-v\/checkout-address-1\/script\.js/);
  assert.match(script, /function loadOriginalBundleProductImage/);
  assert.doesNotMatch(script, /function createBundleTryOnReference/);
  assert.match(script, /formData\.append\("userImage", file/);
  assert.match(script, /formData\.append\("productImage", image\.blob, image\.filename\)/);
  assert.match(script, /formData\.append\("mode", "bundle"\)/);
  assert.match(script, /formData\.append\("bundleItems", JSON\.stringify\(bundleData\)\)/);
  for (const language of ["it", "en", "fr", "de", "es"]) {
    assert.match(script, new RegExp(`\\n  ${language}: \\{[\\s\\S]*?"bundle-tryon-title"`));
  }
  for (const language of ["ro", "sq"]) {
    assert.match(script, new RegExp(`translations\\.${language} = \\{[\\s\\S]*?"bundle-tryon-title"`));
  }
});

test("catalog navigation, stable visual search and private last-stock handling are present", async () => {
  const [index, lastStock, admin, script, server, styles] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("ultimi-disponibili.html", "utf8"),
    readFile("admin.html", "utf8"),
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
    readFile("styles.css", "utf8"),
  ]);
  assert.match(index, /data-catalog-nav-toggle="uomo"/);
  assert.match(index, /data-catalog-nav-toggle="donna"/);
  assert.match(index, /ultimi-disponibili\.html/);
  assert.match(lastStock, /data-last-stock-catalog/);
  assert.match(script, /function renderCatalogNavigation\(\)/);
  assert.match(script, /function ensureCatalogSearch\(\)/);
  assert.match(script, /function renderCatalogSearchResults\(query = ""\)/);
  assert.match(script, /\.toLowerCase\(\)\.includes\(value\)/);
  assert.doesNotMatch(script, /function searchCatalogProducts\(query\)/);
  assert.doesNotMatch(script, /data-catalog-search-query/);
  assert.match(script, /window\.location\.href = productPageUrl\(product\)/);
  assert.match(styles, /\.catalog-search-results\s*\{[\s\S]*?grid-auto-rows:\s*minmax\(96px, auto\)/);
  assert.match(styles, /\.catalog-search-result\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(script, /function renderLastStockCatalog\(\)/);
  assert.match(script, /isLastAvailable/);
  const featuredStart = script.indexOf("function getHomeFeaturedProducts()");
  const featuredEnd = script.indexOf("function findProduct", featuredStart);
  assert.match(script.slice(featuredStart, featuredEnd), /\.filter\(\(product\) => !product\.isLastAvailable\)/);
  assert.match(script, /"scarpe donna": "Scarpe"/);
  assert.match(script, /function getCatalogGenderProducts\(gender\)/);
  assert.match(script, /gender === "donna"[\s\S]*?!product\.isLastAvailable/);
  const catalogStart = script.indexOf("function renderCatalog()");
  const catalogEnd = script.indexOf("function renderLastStockCatalog", catalogStart);
  assert.match(script.slice(catalogStart, catalogEnd), /getCatalogGenderProducts\(catalogState\.gender\)/);
  const lastStockStart = script.indexOf("function renderLastStockCatalog()");
  const lastStockEnd = script.indexOf("function ensureCatalogSearch", lastStockStart);
  assert.match(script.slice(lastStockStart, lastStockEnd), /getGenderProducts\(lastStockGender\)\.filter\(\(product\) => product\.isLastAvailable\)/);
  assert.match(admin, /name="sizes"/);
  assert.match(admin, /name="inventory"/);
  assert.match(server, /function cleanProductInventory/);
  assert.match(server, /const \{ inventory, \.\.\.publicProduct \}/);
  assert.match(server, /async function reduceProductInventory/);
});

test("catalog categories, product pages and galleries follow the storefront flow", async () => {
  const [index, productPage, script, server, styles, dockerfile] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("product.html", "utf8"),
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("Dockerfile", "utf8"),
  ]);
  for (const category of ["Completo", "Tuta", "Giacche leggere", "Jeans lunghi", "Jeans corti", "Pantaloncini", "Scarpe"]) {
    assert.match(script, new RegExp(`name: "${category}"`));
  }
  assert.match(script, /"tracksuits": "Tuta"/);
  assert.match(script, /"two piece sets": "Completo"/);
  assert.match(script, /"denim shorts": "Jeans corti"/);
  assert.match(script, /function normalizeCatalogCategory\(value\)/);
  assert.match(script, /const catalogCategoryOrder =/);
  assert.match(script, /\["T-Shirts", "Polo", "Jeans corti", "Jeans lunghi", "Pantaloncini"\]/);
  assert.match(script, /"Giacche leggere", "Tuta", "Completo", "Scarpe", "Borse Uomo"/);
  assert.match(script, /const catalogMenuColumns =/);
  assert.match(script, /const catalogCategoryTranslations =/);
  assert.match(script, /function translateCatalogCategory\(category\)/);
  for (const language of ["it", "en", "fr", "de", "es", "ro", "sq"]) {
    assert.match(script, new RegExp(`\\n  ${language}: \\{`));
  }
  const navigationStart = script.indexOf("function renderCatalogNavigation()");
  const navigationEnd = script.indexOf("function renderCatalogTiles", navigationStart);
  const navigationSource = script.slice(navigationStart, navigationEnd);
  assert.match(navigationSource, /catalog-nav-category-grid/);
  assert.match(navigationSource, /renderCategoryButton/);
  assert.doesNotMatch(navigationSource, /productPreviewMarkup|<img/);
  assert.match(script, /function renderProductDetail\(\)/);
  assert.match(script, /catalogState\.category && !catalogState\.brand/);
  assert.match(script, /data-catalog-results/);
  assert.match(script, /catalogState\.brand\s*\? document\.querySelector\("\[data-catalog-results\]"\)/);
  assert.match(script, /function selectProductGallerySlide\(control\)/);
  assert.match(script, /function stepProductGallery\(gallery, direction\)/);
  assert.match(script, /function startProductGallerySwipe\(event\)/);
  assert.match(script, /function moveProductGallerySwipe\(event\)/);
  assert.match(script, /function finishProductGallerySwipe\(event\)/);
  assert.match(script, /deltaX < 0 \? 1 : -1/);
  assert.match(script, /galleryClickSuppression\.set\(gallery, Date\.now\(\) \+ 500\)/);
  assert.match(script, /event\.clientX < galleryBounds\.left \+ galleryBounds\.width \/ 2 \? -1 : 1/);
  assert.match(script, /data-gallery-click/);
  assert.match(script, /data-gallery-index="\$\{index\}"/);
  assert.doesNotMatch(script, /data-product-gallery-prev/);
  assert.doesNotMatch(script, /data-product-gallery-next/);
  assert.doesNotMatch(script, /product-gallery-count/);
  assert.match(script, /data-last-stock-gender="uomo"/);
  assert.match(script, /data-last-stock-gender="donna"/);
  assert.match(productPage, /data-product-detail/);
  assert.match(server, /"\/product\.html"/);
  assert.match(dockerfile, /COPY \. \./);
  assert.match(index, /class="last-stock-nav"/);
  assert.match(styles, /\.main-nav > \.last-stock-nav\s*\{[\s\S]*?flex:\s*0 0 100%/);
  assert.match(styles, /\.catalog-nav-category-column\s*\{[\s\S]*?grid-auto-rows:\s*minmax\(54px, auto\)/);
  assert.match(styles, /\.product-gallery-dots button::before\s*\{[\s\S]*?width:\s*5px/);
  assert.match(styles, /touch-action:\s*pan-y pinch-zoom/);
  assert.match(styles, /\.product-detail-gallery\.is-gallery-swiping/);
  assert.doesNotMatch(styles, /\.product-gallery-controls\s*\{/);
  assert.match(styles, /\.product-detail\s*\{/);
});

test("try-on supports clothing, shoes and bags", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.doesNotMatch(script, /product\.sizeType !== "clothing"/);
  assert.match(script, /image: productPrimaryImage\(product\)/);
  assert.match(server, /function cleanTryOnBundleItems/);
  assert.match(server, /put sneakers or shoes on both feet/i);
  assert.match(server, /place bags in the customer's hand/i);
  assert.match(server, /Do not omit, replace, redesign, duplicate or invent any item/);
});

test("single try-on keeps the original customer photo separate and locks facial identity", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.doesNotMatch(script, /function createTryOnReference/);
  assert.match(script, /const originalProductImage = await loadOriginalBundleProductImage/);
  assert.match(script, /formData\.append\("userImage", file/);
  assert.match(script, /formData\.append\("productImage", originalProductImage\.blob, originalProductImage\.filename\)/);
  assert.match(script, /formData\.append\("mode", "single"\)/);
  assert.match(server, /process\.env\.OPENAI_TRYON_MODEL \|\| "gpt-image-2"/);
  assert.match(server, /form\.append\("quality", "high"\)/);
  assert.match(server, /PERSON LOCK — highest priority/);
  assert.match(server, /Do not modify, redraw, regenerate, retouch, beautify/);
  assert.match(server, /replace only the clothing, footwear or accessory pixels/);
});

test("bundle try-on keeps the customer original and normalizes separate product images", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.match(script, /Promise\.all\(bundleTryOnItems\.map\(loadOriginalBundleProductImage\)\)/);
  assert.doesNotMatch(script, /bundle-try-on-reference\.png/);
  assert.match(server, /appendImageFormData\(form, "image\[\]", userImage\)/);
  assert.match(server, /productImages\.forEach\(\(image\) => appendImageFormData\(form, "image\[\]", image\)\)/);
  assert.match(server, /normalizeTryOnProductImage\(productImage, index\)/);
  assert.match(server, /input image 1 is the immutable identity and scene reference/);
  assert.match(server, /Use each original product photo as the authoritative visual reference/);
  assert.match(server, /bundleItems\.length > 0 \|\| hasSeparateProductImages \? "1024x1536" : "1024x1024"/);
  assert.match(server, /Catalog photos may also show boxes, packaging/);
  assert.match(server, /visible from head to toe with both feet unobstructed/);
  assert.match(server, /const bundleIncludesBag = bundleItems\.some/);
  assert.match(server, /The cart contains no bag product/);
  assert.match(server, /If a product name or category conflicts with its photo, follow the photo/);
  assert.match(server, /const openaiTryOnTimeoutMs = 180000/);
  assert.match(server, /readRequestBuffer\(req, 60 \* 1024 \* 1024\)/);
  assert.match(server, /function tryOnFailureMessage\(error, copy\)/);
  assert.match(script, /setBundleTryOnResult\(`<p>\$\{escapeHtml\(message\)\}<\/p>`\)/);
});

test("try-on uses an asynchronous job so proxies cannot break a long image request", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.match(script, /\/api\/try-on\?async=1/);
  assert.match(script, /X-Haller-Request-Id/);
  assert.match(script, /\/api\/try-on\/jobs\/\$\{encodeURIComponent\(data\.jobId\)\}/);
  assert.doesNotMatch(script, /\/api\/try-on\?progress=1/);
  assert.match(server, /function startTryOnJob\(/);
  assert.match(server, /function handleTryOnJob\(/);
  assert.match(server, /tryOnJobMatch/);
  assert.match(server, /asyncJob: url\.searchParams\.get\("async"\) === "1"/);
  assert.match(server, /const tryOnJobRetentionMs = 15 \* 60 \* 1000/);
});

test("checkout gives the original logo its own full-width mobile row", async () => {
  const [checkout, styles] = await Promise.all([readFile("checkout.html", "utf8"), readFile("styles.css", "utf8")]);
  assert.match(checkout, /class="site-header checkout-site-header"/);
  assert.match(checkout, /\/assets-v\/checkout-logo-original-1\/styles\.css/);
  assert.match(styles, /\.checkout-site-header \.header-bar\s*\{[\s\S]*?grid-template-columns:\s*36px minmax\(0, 1fr\) 76px/);
  assert.match(styles, /\.checkout-site-header \.header-bar\s*\{[\s\S]*?grid-template-rows:\s*auto 36px/);
  assert.match(styles, /\.checkout-site-header \.logo\s*\{[\s\S]*?position:\s*static[\s\S]*?transform:\s*none/);
  assert.match(styles, /\.checkout-site-header \.logo\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(styles, /\.checkout-site-header \.logo\s*\{[\s\S]*?width:\s*min\(100%, 520px\)/);
  assert.match(styles, /\.checkout-site-header \.header-actions \.cart-button\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /\.checkout-site-header \.checkout-nav\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("Bunny receives immutable path-versioned storefront assets instead of ignored query versions", async () => {
  const scriptPages = ["account.html", "index.html", "product.html", "ultimi-disponibili.html"];
  const [server, checkout, ...pages] = await Promise.all([
    readFile("server.js", "utf8"),
    readFile("checkout.html", "utf8"),
    ...scriptPages.map((file) => readFile(file, "utf8")),
  ]);
  pages.forEach((html) => assert.match(html, /\/assets-v\/tryon-polling-2\/script\.js/));
  assert.match(checkout, /\/assets-v\/checkout-address-1\/script\.js/);
  assert.match(checkout, /\/assets-v\/checkout-logo-original-1\/styles\.css/);
  assert.match(server, /const versionedPublicFiles = new Map/);
  assert.match(server, /"\/assets-v\/tryon-polling-2\/script\.js", "\/script\.js"/);
  assert.match(server, /"\/assets-v\/checkout-address-1\/script\.js", "\/script\.js"/);
  assert.match(server, /"\/assets-v\/checkout-logo-original-1\/styles\.css", "\/styles\.css"/);
});

test("admin can publish the original or cropped product image while preserving the try-on source", async () => {
  const [styles, admin, adminHtml, server, script] = await Promise.all([
    readFile("styles.css", "utf8"),
    readFile("admin.js", "utf8"),
    readFile("admin.html", "utf8"),
    readFile("server.js", "utf8"),
    readFile("script.js", "utf8"),
  ]);
  assert.match(styles, /\.product-media\s*\{[\s\S]*?aspect-ratio:\s*10 \/ 11/);
  assert.match(styles, /\.product-image\s*\{[\s\S]*?object-fit:\s*contain/);
  assert.match(styles, /\.catalog-search-preview img[\s\S]*?object-fit:\s*contain/);
  assert.match(adminHtml, /data-product-crop-original>Usa originale/);
  assert.match(adminHtml, /data-product-crop-preview-image/);
  assert.match(adminHtml, /data-product-crop-preview-mode="original">Originale/);
  assert.match(adminHtml, /data-product-crop-preview-mode="cropped">Ritagliata/);
  assert.match(adminHtml, /data-product-crop-zoom/);
  assert.match(adminHtml, /data-product-crop-x/);
  assert.match(adminHtml, /data-product-crop-y/);
  assert.doesNotMatch(adminHtml, /data-product-crop-selection/);
  assert.match(adminHtml, /data-product-upload-cancel/);
  assert.match(adminHtml, /data-lucide="circle-stop"/);
  assert.match(styles, /\.product-crop-stage\s*\{[\s\S]*?aspect-ratio:\s*10 \/ 11/);
  assert.match(adminHtml, /Carica pi&ugrave; foto dal Finder/);
  assert.match(adminHtml, /data-product-image-count/);
  assert.match(adminHtml, /fino a 100 foto insieme/);
  assert.match(admin, /const maximumProductImages = 100/);
  assert.match(admin, /const productUploadBatchSize = 8/);
  assert.match(admin, /function addProductImageFiles\(files\)/);
  assert.match(admin, /async function editProductImageEntry\(entry\)/);
  assert.match(admin, /async function uploadPendingProductImages\(productId\)/);
  assert.match(admin, /data-product-image-drag/);
  assert.match(admin, /data-product-image-position/);
  assert.match(admin, /function moveProductImageEntry\(fromIndex, toIndex\)/);
  assert.match(admin, /function commitProductImagePosition\(positionInput\)/);
  assert.match(admin, /function startProductImageDrag\(event\)/);
  assert.match(admin, /function moveProductImageDrag\(event\)/);
  assert.match(admin, /function finishProductImageDrag\(event, cancelled = false\)/);
  assert.match(admin, /document\.elementFromPoint\(event\.clientX, event\.clientY\)/);
  assert.match(admin, /requestedPosition - 1/);
  assert.match(admin, /setTimeout\(\(\) => commitProductImagePosition\(positionInput\), 450\)/);
  assert.match(styles, /\.product-preview-drag\s*\{[\s\S]*?touch-action:\s*none/);
  assert.match(styles, /\.product-preview-item\.is-drop-target\[data-drop-side="before"\]/);
  assert.match(admin, /productUploadController = new AbortController\(\)/);
  assert.match(admin, /productUploadController\?\.abort\(\)/);
  assert.match(admin, /signal: options\.signal/);
  assert.match(admin, /productUploadCancel\?\.addEventListener\("click"/);
  assert.match(admin, /handleSelectedProductImage\(croppedImage, source, "cropped"\)/);
  assert.match(admin, /handleSelectedProductImage\(\{ blob: originalFile, name: originalFile\.name \}, source, "original"\)/);
  assert.match(admin, /cropState\.imageScale = cropState\.baseScale \* cropState\.zoom/);
  assert.match(admin, /cropState\.offsetX = cropDrag\.startOffsetX \+ event\.clientX - cropDrag\.startX/);
  assert.match(admin, /cropState\.offsetY = cropDrag\.startOffsetY \+ event\.clientY - cropDrag\.startY/);
  assert.match(admin, /const sourceCropWidth = Math\.min\([\s\S]*?const sourceCropHeight = Math\.min/);
  assert.match(admin, /sourceX,[\s\S]*?sourceY,[\s\S]*?sourceCropWidth,[\s\S]*?sourceCropHeight/);
  assert.match(admin, /formData\.append\("images", file, filename\)/);
  assert.match(admin, /formData\.append\("originalImage", entry\.originalFile/);
  assert.match(admin, /formData\.append\("imageVariants", JSON\.stringify\(imageVariants\)\)/);
  assert.match(admin, /formData\.append\("originalImageIndexes", JSON\.stringify\(originalImageIndexes\)\)/);
  assert.match(server, /readRequestBuffer\(req, 80 \* 1024 \* 1024\)/);
  assert.match(server, /\.slice\(0, 100\)/);
  assert.match(server, /const originalSavedByIndex = new Map\(/);
  assert.match(server, /const uploadedImages = await mapWithConcurrency\(imageParts, 2/);
  assert.match(server, /const uploadedOriginals = await Promise\.all/);
  assert.match(server, /sourceSaved = saved\.map/);
  assert.match(server, /originalImages: sourceSaved/);
  assert.match(server, /originalImages: mergeUploadedImages\(existing\.originalImages, sourceSaved\)/);
  assert.match(script, /function productPrimaryTryOnImage\(product\)/);
  assert.match(script, /tryOnImage: productPrimaryTryOnImage\(product\)/);
  assert.match(admin, /async function readAdminApiResponse\(response, fallbackMessage\)/);
  assert.match(admin, /Caricamento interrotto dal server/);
  assert.match(server, /async function pruneOrphanProductUploads/);
  assert.match(server, /async function pruneStaleStorageTemps/);
  assert.match(server, /async function ensureProductUploadCapacity/);
  assert.match(server, /return await handleApi\(req, res, url\)/);
  assert.match(server, /return json\(res, 507/);
  assert.match(server, /new S3Client/);
  assert.match(server, /new PutObjectCommand/);
  assert.match(server, /new PutBucketCorsCommand/);
  assert.match(server, /async function pruneOrphanProductObjects/);
  assert.match(server, /if \(!productImageStorage\) await ensureProductUploadCapacity\(requiredBytes\)/);
  assert.match(adminHtml, /name="zoomImages"/);
  assert.match(adminHtml, /admin\.js\?v=zoom-hires-crop-2/);
});

test("checkout renders product images from the cart", async () => {
  const [checkout, script, styles] = await Promise.all([readFile("checkout.html", "utf8"), readFile("script.js", "utf8"), readFile("styles.css", "utf8")]);
  assert.match(checkout, /data-checkout-summary-products/);
  assert.match(script, /function renderCheckoutProductSummary\(\)/);
  assert.match(script, /function getCheckoutItemImage\(item\)/);
  assert.match(script, /renderCheckoutProductSummary\(\);/);
  assert.match(script, /function removeCheckoutItem\(index\)/);
  assert.match(script, /data-checkout-remove-index/);
  assert.match(styles, /\.checkout-summary-product-image img\s*\{[\s\S]*?object-fit:\s*contain/);
  assert.match(styles, /\.checkout-summary-remove\s*\{/);
});

test("responsive product images preserve originals and keep the navigation menu text-only", async () => {
  const [index, script, server] = await Promise.all([readFile("index.html", "utf8"), readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.match(server, /const productImageRenditionWidths = \[480, 720, 1080, 1440\]/);
  assert.match(server, /webp\(\{ quality: width >= 1080 \? 98 : 95/);
  assert.match(server, /const existingRenditionsAvailable = await productImageRenditionsExist/);
  assert.match(server, /const reusableRenditions = force \|\| !existingRenditionsAvailable \? \[\] : existing\[task\.image\]/);
  assert.match(script, /function productImageSrcset\(product, image\)/);
  assert.match(script, /function productZoomImageSource\(product, image, index\)/);
  assert.match(script, /data-original-src=/);
  const mediaMarkupStart = script.indexOf("function createProductMediaMarkup(product, detail = false)");
  const mediaMarkupEnd = script.indexOf("function productPrimaryImage", mediaMarkupStart);
  const mediaMarkupSource = script.slice(mediaMarkupStart, mediaMarkupEnd);
  assert.match(mediaMarkupSource, /const highQualityPreviewSizes = "\(max-width: 760px\) calc\(100vw - 32px\), 52vw"/);
  assert.match(mediaMarkupSource, /sizes="\$\{highQualityPreviewSizes\}"/);
  assert.doesNotMatch(mediaMarkupSource, /galleryPreviewSizes/);
  const zoomSourceStart = script.indexOf("function productZoomImageSource(product, image, index)");
  const zoomSourceEnd = script.indexOf("function productPageUrl", zoomSourceStart);
  const zoomSourceImplementation = script.slice(zoomSourceStart, zoomSourceEnd);
  assert.match(zoomSourceImplementation, /const dedicatedZoomSource = Array\.isArray\(product\?\.zoomImages\)/);
  assert.match(zoomSourceImplementation, /if \(dedicatedZoomSource\) return withProductImageVersion\(dedicatedZoomSource\)/);
  assert.match(zoomSourceImplementation, /const publishedSource = Array\.isArray\(product\?\.images\)/);
  assert.doesNotMatch(zoomSourceImplementation, /originalImages/);
  const zoomOpenStart = script.indexOf("function openProductImageZoom(control)");
  const zoomOpenEnd = script.indexOf("function adjustProductImageZoom", zoomOpenStart);
  const zoomOpenImplementation = script.slice(zoomOpenStart, zoomOpenEnd);
  assert.match(zoomOpenImplementation, /zoomImage\.removeAttribute\("srcset"\)/);
  assert.match(zoomOpenImplementation, /zoomImage\.src = source/);
  assert.doesNotMatch(zoomOpenImplementation, /zoomImage\.src = previewSource/);
  assert.match(server, /async function optimizeExistingProductZoomImages/);
  assert.match(server, /createAndStoreProductZoomImage/);
  assert.match(server, /createMatchingProductZoomImage/);
  assert.match(server, /original-pixels-matching-crop-v2/);
  assert.match(server, /product\.zoomImages\[task\.index\] = generated\.url/);
  assert.match(server, /"\/api\/internal\/product-zoom-image-optimization"/);
  assert.match(server, /function productZoomDeliveryPath\(value\)/);
  assert.match(server, /new GetObjectCommand/);
  assert.match(server, /"\/product-images\/"/);
  assert.match(server, /"Cache-Control": "public, max-age=31536000, immutable"/);
  assert.match(script, /data-product-image-deferred/);
  assert.match(script, /function observeProductImages\(root = document\)/);
  assert.match(index, /assets\/hero-man-v2\.webp/);
  const navigationStart = script.indexOf("function renderCatalogNavigation()");
  const navigationEnd = script.indexOf("function renderCatalogTiles", navigationStart);
  assert.doesNotMatch(script.slice(navigationStart, navigationEnd), /productPreviewMarkup|<img/);
});
