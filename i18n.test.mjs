import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlFiles = ["index.html", "account.html", "checkout.html", "ultimi-disponibili.html", "product.html", "spedizioni.html", "termini.html", "privacy.html", "admin.html"];

test("one language controller owns every picker", async () => {
  const [i18n, script] = await Promise.all([readFile("i18n.js", "utf8"), readFile("script.js", "utf8")]);
  assert.match(i18n, /picker\.dataset\.i18nBound = "true"/);
  assert.match(script, /window\.addEventListener\("haller-language-change"/);
  assert.doesNotMatch(script, /languageToggle\.addEventListener/);
});

test("Aurora sends and enforces the selected language", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.match(script, /language: siteLanguage/);
  assert.match(server, /const siteChatLanguages = \{/);
  assert.match(server, /Rispondi esclusivamente in \$\{languageConfig\.name\}/);
  assert.doesNotMatch(server, /Scrivi in italiano, con tono caldo/);
  for (const language of ["it", "en", "fr", "de", "es"]) {
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
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    assert.match(html, /i18n\.js\?v=sitewide-language-5/, file);
    assert.doesNotMatch(html, /sitewide-language-[1234]/, file);
  }
});

test("checkout exposes a multilingual bundle try-on", async () => {
  const [checkout, script] = await Promise.all([readFile("checkout.html", "utf8"), readFile("script.js", "utf8")]);
  assert.match(checkout, /data-bundle-tryon/);
  assert.match(checkout, /script\.js\?v=product-image-choice-1/);
  assert.match(script, /function loadOriginalBundleProductImage/);
  assert.doesNotMatch(script, /function createBundleTryOnReference/);
  assert.match(script, /formData\.append\("userImage", file/);
  assert.match(script, /formData\.append\("productImage", image\.blob, image\.filename\)/);
  assert.match(script, /formData\.append\("mode", "bundle"\)/);
  assert.match(script, /formData\.append\("bundleItems", JSON\.stringify\(bundleData\)\)/);
  for (const language of ["it", "en", "fr", "de", "es"]) {
    assert.match(script, new RegExp(`\\n  ${language}: \\{[\\s\\S]*?"bundle-tryon-title"`));
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
  assert.match(script, /function renderProductDetail\(\)/);
  assert.match(script, /function selectProductGallerySlide\(control\)/);
  assert.match(script, /data-gallery-index="\$\{index\}"/);
  assert.doesNotMatch(script, /data-product-gallery-prev/);
  assert.doesNotMatch(script, /data-product-gallery-next/);
  assert.doesNotMatch(script, /product-gallery-count/);
  assert.match(script, /data-last-stock-gender="uomo"/);
  assert.match(script, /data-last-stock-gender="donna"/);
  assert.match(productPage, /data-product-detail/);
  assert.match(server, /"\/product\.html"/);
  assert.match(dockerfile, /COPY index\.html product\.html/);
  assert.match(index, /class="last-stock-nav"/);
  assert.match(styles, /\.main-nav > \.last-stock-nav\s*\{[\s\S]*?flex:\s*0 0 100%/);
  assert.match(styles, /\.product-gallery-dots button::before\s*\{[\s\S]*?width:\s*5px/);
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

test("bundle try-on sends untouched customer and product image files separately", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.match(script, /Promise\.all\(bundleTryOnItems\.map\(loadOriginalBundleProductImage\)\)/);
  assert.doesNotMatch(script, /bundle-try-on-reference\.png/);
  assert.match(server, /appendImageFormData\(form, "image\[\]", userImage\)/);
  assert.match(server, /productImages\.forEach\(\(image\) => appendImageFormData\(form, "image\[\]", image\)\)/);
  assert.match(server, /Input image 1 is the customer's original, unmodified photo/);
  assert.match(server, /Use each original product photo as the authoritative visual reference/);
  assert.match(server, /bundleItems\.length > 0 \? "1024x1536" : "1024x1024"/);
  assert.match(server, /Catalog photos may also show boxes, packaging/);
  assert.match(server, /visible from head to toe, both feet unobstructed/);
  assert.match(server, /const bundleIncludesBag = bundleItems\.some/);
  assert.match(server, /The cart contains no bag product/);
  assert.match(server, /If a product name or category conflicts with its photo, follow the photo/);
  assert.match(server, /const openaiTryOnTimeoutMs = 180000/);
  assert.match(server, /readRequestBuffer\(req, 60 \* 1024 \* 1024\)/);
  assert.match(server, /function tryOnFailureMessage\(error, copy\)/);
  assert.match(script, /setBundleTryOnResult\(`<p>\$\{escapeHtml\(message\)\}<\/p>`\)/);
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
  assert.match(admin, /productUploadQueue = \{ files, productId, index: 0, variants: \[\] \}/);
  assert.match(admin, /productUploadController = new AbortController\(\)/);
  assert.match(admin, /productUploadController\?\.abort\(\)/);
  assert.match(admin, /signal: options\.signal/);
  assert.match(admin, /productUploadCancel\?\.addEventListener\("click"/);
  assert.match(admin, /openNextProductCrop\(\)/);
  assert.match(admin, /handleSelectedProductImage\(croppedImage, source, "cropped"\)/);
  assert.match(admin, /handleSelectedProductImage\(\{ blob: originalFile, name: originalFile\.name \}, source, "original"\)/);
  assert.match(admin, /cropState\.imageScale = cropState\.baseScale \* cropState\.zoom/);
  assert.match(admin, /cropState\.offsetX = cropDrag\.startOffsetX \+ event\.clientX - cropDrag\.startX/);
  assert.match(admin, /cropState\.offsetY = cropDrag\.startOffsetY \+ event\.clientY - cropDrag\.startY/);
  assert.match(admin, /const sourceCropWidth = Math\.min\([\s\S]*?const sourceCropHeight = Math\.min/);
  assert.match(admin, /sourceX,[\s\S]*?sourceY,[\s\S]*?sourceCropWidth,[\s\S]*?sourceCropHeight/);
  assert.match(admin, /formData\.append\("images", file, filename\)/);
  assert.match(admin, /formData\.append\("originalImage", originalFile/);
  assert.match(server, /originalImages: mergeUploadedImages\(existing\.originalImages, sourceSaved\)/);
  assert.match(script, /function productPrimaryTryOnImage\(product\)/);
  assert.match(script, /tryOnImage: productPrimaryTryOnImage\(product\)/);
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
