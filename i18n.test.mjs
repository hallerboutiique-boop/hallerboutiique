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
  assert.match(checkout, /\/assets-v\/tshirts-restored-1\/script\.js/);
  assert.match(script, /function prepareTryOnCustomerFile/);
  assert.doesNotMatch(script, /function createBundleTryOnReference/);
  assert.match(script, /formData\.append\("userImage", preparedCustomerFile/);
  assert.doesNotMatch(script, /formData\.append\("productImage"/);
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
  const [index, lastStock, admin, adminJs, script, server, styles, productInventory] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("ultimi-disponibili.html", "utf8"),
    readFile("admin.html", "utf8"),
    readFile("admin.js", "utf8"),
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("product-inventory.mjs", "utf8"),
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
  const genderProductsStart = script.indexOf("function getCatalogGenderProducts(gender)");
  const genderProductsEnd = script.indexOf("function getCategoryProducts", genderProductsStart);
  assert.match(script.slice(genderProductsStart, genderProductsEnd), /getGenderProducts\(gender\)\.filter\(\(product\) => !product\.isLastAvailable\)/);
  const searchResultsStart = script.indexOf("function renderCatalogSearchResults(query = \"\")");
  const searchResultsEnd = script.indexOf("function loadDeferredProductImage", searchResultsStart);
  assert.match(script.slice(searchResultsStart, searchResultsEnd), /getAllProducts\(\)\.filter\(\(product\) => !product\.isLastAvailable\)/);
  assert.match(index, /\/assets-v\/tshirts-restored-1\/script\.js/);
  const womanSlideStart = index.indexOf("hero-slide hero-slide-woman");
  const womanSlideEnd = index.indexOf("</article>", womanSlideStart);
  const womanSlide = index.slice(womanSlideStart, womanSlideEnd);
  assert.match(womanSlide, /data-i18n-html="hero-title">LUSSO<br>QUALITÀ<br>STILE/);
  assert.match(womanSlide, /data-i18n-html="hero-description">Scopri le ultime novit/);
  assert.match(index, /data-src="\/assets\/hero-videos\/man-turn-balenciaga\.mp4"/);
  assert.match(index, /data-src="\/assets\/hero-videos\/woman-glasses-smile\.mp4"/);
  assert.equal((index.match(/preload="none"/g) || []).length, 2);
  assert.match(script, /function playHeroCharacterVideo\(slide\)/);
  assert.match(script, /if \(!video\.hasAttribute\("src"\)\)/);
  assert.match(script, /if \(!heroCharacterVideoPlaying && Date\.now\(\) >= heroRotationResumeAt\)/);
  assert.match(styles, /\.hero-slide\.is-video-visible > \.hero-character-video/);
  assert.doesNotMatch(index, /class="tryon-home-callout"/);
  assert.doesNotMatch(index, /data-i18n-html="tryon-hero-title">INDOSSA/);
  assert.match(index, /class="benefit-tryon"[\s\S]*?data-i18n-html="tryon-hero-description">Per indossare i vestiti<br>come fossi in negozio\./);
  assert.match(script, /"tryon-hero-title": "INDOSSA"/);
  assert.match(script, /"tryon-hero-description": "Per indossare i vestiti<br>come fossi in negozio\."/);
  assert.match(styles, /\.benefits-main\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, 1fr\)/);
  assert.match(styles, /\.benefit-tryon-link\s*\{/);
  const catalogStart = script.indexOf("function renderCatalog()");
  const catalogEnd = script.indexOf("function renderLastStockCatalog", catalogStart);
  assert.match(script.slice(catalogStart, catalogEnd), /getCatalogGenderProducts\(catalogState\.gender\)/);
  assert.match(script.slice(catalogStart, catalogEnd), /if \(!productCatalogDataReady\)/);
  assert.match(script.slice(catalogStart, catalogEnd), /catalogRoot\.replaceChildren\(\)/);
  assert.match(script, /productCatalogDataReady = true;[\s\S]*?renderCatalog\(\)/);
  assert.match(script, /productCatalogDataReady = false;[\s\S]*?window\.setTimeout\(loadProductOverrides, productCatalogRetryDelay\)/);
  const lastStockStart = script.indexOf("function renderLastStockCatalog()");
  const lastStockEnd = script.indexOf("function ensureCatalogSearch", lastStockStart);
  assert.match(script.slice(lastStockStart, lastStockEnd), /getGenderProducts\(lastStockGender\)\.filter\(\(product\) => product\.isLastAvailable\)/);
  assert.match(admin, /name="sizes"/);
  assert.match(admin, /name="inventory"/);
  assert.match(admin, /name="inventoryBySize"/);
  assert.match(admin, /data-product-size-inventory-grid/);
  assert.match(admin, /Scarpe EU 36-45/);
  assert.match(admin, /Jeans EU 40-56/);
  assert.match(admin, /data-product-size-inventory-apply/);
  assert.match(admin, /data-product-size-inventory-clear/);
  assert.match(adminJs, /data-product-size-inventory-step/);
  assert.match(adminJs, /function resolveAdminProductSizeType/);
  assert.match(adminJs, /const productUploadBatchSize = 10/);
  assert.match(adminJs, /Cerca un prodotto per visualizzare tutti i risultati corrispondenti/);
  assert.match(script, /inventoryTrackedBySize/);
  assert.match(script, /availableSizes/);
  assert.match(script, /translate\("select-size"\)/);
  assert.match(script, /data-size-option\]:not\(:disabled\)/);
  assert.match(script, /const sneakerSizes = \["36", "37", "38"[\s\S]*?"45"\]/);
  assert.match(script, /const jeansSizes = \["40", "42", "44", "46", "48", "50", "52", "54", "56"\]/);
  assert.match(script, /function resolveCatalogProductSizeType/);
  assert.match(server, /function cleanProductInventory/);
  assert.match(server, /resolveProductSizeType/);
  assert.match(productInventory, /sneakers:\s*\["36", "37", "38"[\s\S]*?"45"\]/);
  assert.match(server, /slice\(0, 10\)/);
  assert.match(server, /const \{ inventory, inventoryBySize, \.\.\.publicProduct \}/);
  assert.match(server, /inventoryTrackedBySize/);
  assert.match(server, /availableInventorySizes/);
  assert.match(server, /isLastAvailable:\s*!isBag && inventoryTotal === 1/);
  assert.match(server, /"Cache-Control": "private, no-store"/);
  assert.match(server, /async function reduceProductInventory/);
  assert.match(server, /enqueueProductMutation\(\(\) => reduceProductInventory\(products\)\)/);
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

test("try-on supports every catalog product including shoes", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.doesNotMatch(script, /function isTryOnShoeProduct/);
  assert.doesNotMatch(script, /isTryOnShoeProduct\(/);
  assert.match(script, /function createTryOnMarkup\(product\)\s*\{\s*return `<button class="tryon-action"/);
  assert.match(script, /if \(!product\) return;\s*tryOnProduct = product/);
  assert.match(script, /image: productPrimaryImage\(product\)/);
  assert.doesNotMatch(server, /function isTryOnShoeItem/);
  assert.doesNotMatch(server, /isTryOnShoeItem\(/);
  assert.match(server, /normalizeTryOnCustomerImage/);
  assert.match(server, /customer image normalization failed/);
  assert.doesNotMatch(server, /copy\.shoes/);
  assert.match(server, /For a footwear product, replace the customer's existing footwear/);
  assert.match(server, /If the referenced product is footwear, replace the customer's current footwear/);
  assert.match(server, /Footwear products are supported/);
});

test("single try-on uses only the first original product photo and locks facial identity", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.doesNotMatch(script, /function createTryOnReference/);
  assert.doesNotMatch(script, /function productTryOnImages\(product\)/);
  assert.match(script, /const preparedCustomerFile = await prepareTryOnCustomerFile\(file\)/);
  assert.match(script, /formData\.append\("userImage", preparedCustomerFile/);
  assert.doesNotMatch(script, /formData\.append\("customerImage"/);
  assert.match(script, /formData\.append\("mode", "single"\)/);
  assert.match(server, /process\.env\.OPENAI_TRYON_MODEL \|\| "gpt-image-2"/);
  assert.match(server, /form\.append\("quality", "high"\)/);
  assert.match(server, /form\.append\("output_format", "jpeg"\)/);
  assert.match(server, /form\.append\("output_compression", "94"\)/);
  assert.match(server, /loadCatalogTryOnProductImages\(productIds\)/);
  assert.match(server, /Input image 2 is the authoritative first original catalog photo/);
  assert.doesNotMatch(server, /prepareTryOnReferences\(input\)/);
  assert.match(server, /PERSON LOCK — highest priority/);
  assert.match(server, /Do not modify, redraw, regenerate, retouch, beautify/);
  assert.match(server, /replace only the product's natural wearing or carrying area/);
  assert.match(server, /matching pair on both feet/);
});

test("bundle try-on uses only the first photo for every selected product", async () => {
  const [checkout, script, server] = await Promise.all([
    readFile("checkout.html", "utf8"),
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
  ]);
  assert.match(checkout, /data-i18n="bundle-tryon-limit">Tutti i prodotti · massimo 2 prodotti/);
  assert.doesNotMatch(script, /isTryOnShoeProduct/);
  assert.match(script, /\.slice\(0, 2\)/);
  assert.doesNotMatch(script, /Promise\.all\(bundleTryOnItems\.map\(loadOptionalTryOnProductImage\)\)/);
  assert.match(script, /referenceImageIndex: index \+ 2/);
  assert.match(server, /const source = cleanProductImages\(product\?\.originalImages\)\[0\]/);
  assert.match(server, /tryOnProductImageCache/);
  assert.match(server, /with no catalog photo available; use the product name and category as the reference/);
  assert.match(server, /const legacyBundle = bundleItems\.every/);
  assert.doesNotMatch(script, /bundle-try-on-reference\.png/);
  assert.match(server, /appendImageFormData\(form, "image\[\]", userImage\)/);
  assert.match(server, /productImages\.forEach\(\(image\) => appendImageFormData\(form, "image\[\]", image\)\)/);
  assert.match(server, /else \{\s*appendImageFormData\(form, "image", userImage\)/);
  assert.match(server, /normalizeTryOnProductImage\(productImage, index\)/);
  assert.match(server, /input image 1 is the immutable identity and scene reference/);
  assert.match(server, /Use each selected product's first original catalog photo as the authoritative visual reference/);
  assert.doesNotMatch(server, /openaiTryOnMaximumInputImages/);
  assert.doesNotMatch(server, /createTryOnReferenceSheet/);
  assert.match(server, /bundleItems\.length > 0 \|\| hasSeparateProductImages \? "1024x1536" : "1024x1024"/);
  assert.match(server, /strict maximum of two products/);
  assert.match(server, /referenced products may be clothing, footwear, bags or accessories/);
  assert.match(server, /fit footwear naturally to both feet/);
  assert.match(server, /Ignore every unreferenced item and background prop completely/);
  assert.match(server, /bundleItems\.length > 2/);
  assert.doesNotMatch(server, /bundleItems\.some\(isTryOnShoeItem\)/);
  assert.match(server, /return badRequest\(res, copy\.bundleRules\)/);
  assert.match(server, /const openaiTryOnTimeoutMs = 180000/);
  assert.match(server, /readRequestBuffer\(req, 60 \* 1024 \* 1024\)/);
  assert.match(server, /function tryOnFailureMessage\(error, copy\)/);
  assert.match(server, /billing hard limit/);
  assert.match(server, /return copy\.billing/);
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

test("checkout keeps the home logo size inline with the header icons", async () => {
  const [checkout, styles] = await Promise.all([readFile("checkout.html", "utf8"), readFile("styles.css", "utf8")]);
  assert.match(checkout, /class="site-header utility-site-header checkout-site-header"/);
  assert.match(checkout, /\/assets-v\/admin-original-price-5\/styles\.css/);
  assert.match(styles, /\.checkout-site-header \.header-bar\s*\{[\s\S]*?grid-template-columns:\s*36px minmax\(0, 1fr\) 76px/);
  assert.match(styles, /\.checkout-site-header \.header-bar\s*\{[\s\S]*?grid-template-rows:\s*76px/);
  assert.match(styles, /\.checkout-site-header \.logo\s*\{[\s\S]*?position:\s*absolute[\s\S]*?top:\s*50%[\s\S]*?left:\s*50%/);
  assert.match(styles, /\.checkout-site-header \.logo\s*\{[\s\S]*?transform:\s*translate\(-50%, -50%\)/);
  assert.match(styles, /\.checkout-site-header \.logo\s*\{[\s\S]*?width:\s*min\(52vw, 260px\)/);
  assert.match(styles, /\.checkout-site-header \.logo\s*\{[\s\S]*?max-width:\s*calc\(100vw - 168px\)/);
  assert.match(styles, /\.checkout-site-header \.header-actions \.cart-button\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /\.checkout-site-header \.checkout-nav\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("mobile logos use collision-free layouts on every storefront page", async () => {
  const pageNames = ["index.html", "account.html", "checkout.html", "product.html", "ultimi-disponibili.html", "spedizioni.html", "termini.html", "privacy.html", "admin.html"];
  const [styles, ...pages] = await Promise.all([
    readFile("styles.css", "utf8"),
    ...pageNames.map((file) => readFile(file, "utf8")),
  ]);
  pages.forEach((html, index) => {
    const expectedStyles = pageNames[index] === "admin.html"
      ? /\/assets-v\/catalog-controls-1\/styles\.css/
      : pageNames[index] === "index.html"
        ? /\/assets-v\/hero-videos-1\/styles\.css/
        : /\/assets-v\/admin-original-price-5\/styles\.css/;
    assert.match(html, expectedStyles, pageNames[index]);
  });
  assert.match(pages[1], /class="site-header utility-site-header account-site-header"/);
  assert.match(pages[1], /class="icon-button is-current account-current-action"/);
  assert.match(pages[8], /class="site-header utility-site-header admin-site-header"/);
  assert.match(styles, /\.utility-site-header \.header-bar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(116px, 1fr\) auto minmax\(116px, 1fr\)/);
  assert.match(styles, /\.utility-site-header:not\(\.checkout-site-header\) \.header-bar\s*\{[\s\S]*?grid-template-columns:\s*36px minmax\(0, 1fr\) 76px/);
  assert.match(styles, /\.utility-site-header:not\(\.checkout-site-header\) \.logo\s*\{[\s\S]*?grid-column:\s*2/);
  assert.match(styles, /\.site-header:not\(\.utility-site-header\) \.logo img\s*\{[\s\S]*?width:\s*min\(52vw, 260px\)/);
  assert.match(styles, /\.utility-site-header \.logo\s*\{[\s\S]*?width:\s*min\(52vw, 260px\)/);
  assert.match(styles, /\.legal-header\s*\{[\s\S]*?grid-template-columns:\s*minmax\(170px, 1fr\) auto minmax\(170px, 1fr\)/);
  assert.match(styles, /\.legal-brand img\s*\{[\s\S]*?width:\s*clamp\(390px, 33\.9vw, 520px\)/);
  assert.match(styles, /@media \(max-width: 980px\)\s*\{[\s\S]*?\.legal-brand img\s*\{[\s\S]*?width:\s*min\(58vw, 330px\)/);
  assert.match(styles, /\.legal-brand img\s*\{[\s\S]*?width:\s*min\(52vw, 260px\)/);
  assert.match(styles, /\.legal-header\s*\{[\s\S]*?grid-template-columns:\s*36px minmax\(0, 1fr\) 36px/);
});

test("Bunny receives immutable path-versioned storefront assets instead of ignored query versions", async () => {
  const scriptPages = ["account.html", "product.html", "ultimi-disponibili.html"];
  const [server, checkout, index, ...pages] = await Promise.all([
    readFile("server.js", "utf8"),
    readFile("checkout.html", "utf8"),
    readFile("index.html", "utf8"),
    ...scriptPages.map((file) => readFile(file, "utf8")),
  ]);
  pages.forEach((html) => assert.match(html, /\/assets-v\/tshirts-restored-1\/script\.js/));
  assert.match(index, /\/assets-v\/tshirts-restored-1\/script\.js/);
  assert.match(index, /\/assets-v\/hero-videos-1\/styles\.css/);
  assert.match(checkout, /\/assets-v\/tshirts-restored-1\/script\.js/);
  assert.match(checkout, /\/assets-v\/admin-original-price-5\/styles\.css/);
  assert.match(server, /const versionedPublicFiles = new Map/);
  assert.match(server, /"\/assets-v\/catalog-controls-1\/script\.js", "\/script\.js"/);
  assert.match(server, /"\/assets-v\/catalog-controls-1\/admin\.js", "\/admin\.js"/);
  assert.match(server, /"\/assets-v\/hero-videos-1\/script\.js", "\/script\.js"/);
  assert.match(server, /"\/assets-v\/hero-videos-1\/styles\.css", "\/styles\.css"/);
  assert.match(server, /"\/assets-v\/tshirts-restored-1\/script\.js", "\/script\.js"/);
  assert.match(server, /"\/assets-v\/tryon-no-shoes-1\/script\.js", "\/script\.js"/);
  assert.match(server, /"\/assets-v\/admin-original-price-5\/styles\.css", "\/styles\.css"/);
});

test("delivery messaging calculates a road estimate from Monza and spells out minutes", async () => {
  const [index, script, server] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
  ]);
  assert.match(index, /calcolare il tempo di consegna dalla sede di Monza/);
  assert.match(script, /Consegna stimata: \{minutes\} minuti\./);
  assert.match(script, /fetch\("\/api\/delivery-estimate"/);
  assert.match(server, /router\.project-osrm\.org\/route\/v1\/driving/);
  assert.match(server, /COURIER_ORIGIN\.longitude/);
  assert.match(server, /url\.pathname === "\/api\/delivery-estimate"/);
  assert.doesNotMatch(script, /preciseLocation\.accuracy\}m/);
  assert.doesNotMatch(script, /\{accuracy\}/);
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
  assert.match(adminHtml, /fino a 15 foto: vengono caricate in gruppi di massimo 10/);
  assert.match(adminHtml, /data-product-image-count>0 \/ 15/);
  assert.match(admin, /const maximumProductImages = 15/);
  assert.match(admin, /const maximumAiProductImages = 100/);
  assert.match(admin, /const productUploadBatchSize = 10/);
  assert.match(admin, /function syncOriginalPriceFromDiscount\(\)/);
  assert.match(admin, /productForm\?\.elements\.discount\?\.addEventListener\("input", syncOriginalPriceFromDiscount\)/);
  assert.match(admin, /productForm\?\.elements\.finalPrice\?\.addEventListener\("input", syncOriginalPriceFromDiscount\)/);
  assert.match(adminHtml, /Si calcola automaticamente da prezzo finale e sconto/);
  assert.match(styles, /\.product-editor-form \.product-gallery-editor-header\s*\{[\s\S]*?order:\s*-3/);
  assert.match(styles, /\.product-editor-form \.product-preview-grid\s*\{[\s\S]*?display:\s*flex[\s\S]*?order:\s*-2/);
  assert.match(styles, /\.product-size-inventory-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(admin, /async function addProductImageFiles\(files\)/);
  assert.match(admin, /async function prepareProductUploadImage\(file\)/);
  assert.match(admin, /const productUploadMaximumEdge = 2400/);
  assert.match(admin, /canvas\.toBlob\(resolve, "image\/webp", productUploadWebpQuality\)/);
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
  assert.match(styles, /\.product-preview-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.product-preview-actions button\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*38px/);
  assert.match(styles, /\.product-preview-actions button\[data-product-image-edit\]\s*\{/);
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
  assert.match(server, /const maximumStoredProductImages = 15/);
  assert.match(server, /\.slice\(0, maximumStoredProductImages\)/);
  assert.match(server, /const originalSavedByIndex = new Map\(/);
  assert.match(server, /const uploadedImages = await mapWithConcurrency\(imageParts, 2/);
  assert.match(server, /uploadedOriginals = await Promise\.all/);
  assert.match(server, /scheduleProductImageOptimization\(productId\)/);
  assert.match(server, /optimization: "queued"/);
  assert.match(server, /if \(productImageStorage\) \{\s*return storeProductImage\(name, data, "image\/webp"\)/);
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
  assert.match(server, /AllowedMethods: \["GET", "HEAD", "PUT"\]/);
  assert.match(server, /getSignedUrl\(productImageStorage, new PutObjectCommand/);
  assert.match(server, /url\.pathname === "\/api\/admin\/product-image-upload-urls"/);
  assert.match(server, /await inspectDirectProductUpload\(entry\.key, productId\)/);
  assert.match(server, /fieldValue\(parts, "directUploads", 12000\)/);
  assert.match(server, /async function pruneOrphanProductObjects/);
  assert.match(server, /if \(!productImageStorage\) await ensureProductUploadCapacity\(requiredBytes\)/);
  assert.match(admin, /const directProductUploadConcurrency = 4/);
  assert.match(admin, /api\("\/api\/admin\/product-image-upload-urls"/);
  assert.match(admin, /request\.open\("PUT", upload\.uploadUrl\)/);
  assert.match(admin, /formData\.append\("directUploads"/);
  assert.match(admin, /return uploadProductImagesThroughServer\(entries, productId, \{ signal \}\)/);
  assert.match(adminHtml, /name="zoomImages"/);
  assert.match(adminHtml, /\/assets-v\/catalog-controls-1\/admin\.js/);
});

test("admin can choose exactly which catalog products appear on the home page", async () => {
  const [adminHtml, admin, script, server, styles] = await Promise.all([
    readFile("admin.html", "utf8"),
    readFile("admin.js", "utf8"),
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
    readFile("styles.css", "utf8"),
  ]);

  assert.match(adminHtml, /data-admin-tab="home"/);
  assert.match(adminHtml, /data-home-products-grid/);
  assert.match(adminHtml, /data-home-products-save/);
  assert.match(admin, /function normalizeSearchText\(value\)/);
  assert.match(admin, /function renderHomeProducts\(\)/);
  assert.match(admin, /body: JSON\.stringify\(\{ homeProductIds: orderedIds \}\)/);
  assert.match(script, /if \(Array\.isArray\(homeProductIds\)\)/);
  assert.match(script, /\.filter\(\(product\) => !product\.isLastAvailable\)/);
  assert.match(server, /homeProductIds: overrides\.homeProductIds/);
  assert.match(server, /overrides\.homeProductIds = cleanSelection\(body\.homeProductIds\)/);
  assert.match(styles, /\.home-products-grid/);
  assert.match(adminHtml, /\/assets-v\/catalog-controls-1\/styles\.css/);
});

test("admin controls new arrivals and can remove products from the catalog", async () => {
  const [index, productPage, adminHtml, admin, script, server, styles] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("product.html", "utf8"),
    readFile("admin.html", "utf8"),
    readFile("admin.js", "utf8"),
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
    readFile("styles.css", "utf8"),
  ]);

  assert.match(adminHtml, /data-admin-tab="arrivals"/);
  assert.match(adminHtml, /data-new-arrivals-grid/);
  assert.match(adminHtml, /data-new-arrivals-save/);
  assert.match(admin, /function renderNewArrivals\(\)/);
  assert.match(admin, /body: JSON\.stringify\(\{ newArrivalProductIds: orderedIds \}\)/);
  assert.match(server, /overrides\.newArrivalProductIds = cleanSelection\(body\.newArrivalProductIds\)/);
  assert.match(script, /function getNewArrivalProducts\(\)/);
  assert.match(script, /catalogState\.view === "new-arrivals"/);
  assert.match(index, /index\.html\?view=new-arrivals#selezione/);
  assert.match(productPage, /index\.html\?view=new-arrivals#selezione/);

  assert.match(adminHtml, /data-product-delete/);
  assert.match(admin, /body: JSON\.stringify\(\{ id, mode: "delete" \}\)/);
  assert.match(server, /overrides\.deletedProductIds = \[\.\.\.new Set/);
  assert.match(script, /\.filter\(\(product\) => !deletedProductIds\.has\(product\.id\)\)/);
  assert.match(styles, /\.product-delete-button/);
});

test("requested Hermes products and only the unwanted men set entry are absent", async () => {
  const script = await readFile("script.js", "utf8");
  for (const product of ["Mini Bag Hermès", "Kelly Bag Hermès", "Wallet Bag Hermès", "Dogon Wallet Hermès"]) {
    assert.doesNotMatch(script, new RegExp(`item\\("${product}`));
  }
  assert.match(script, /uomo: new Set\(\["Completo"\]\)/);
  assert.doesNotMatch(script, /uomo: new Set\(\[[^\]]*"T-Shirts"/);
  assert.match(script, /"Borse Uomo": "Pochette"/);
  assert.match(script, /getCategoriesForGender\(gender\)\.filter\(\(category\) => !hiddenCategories\.has\(category\)\)/);
});

test("Fly keeps the production machine on performance CPU with 2 GB RAM", async () => {
  const fly = await readFile("fly.toml", "utf8");
  assert.match(fly, /cpu_kind = 'performance'/);
  assert.match(fly, /cpus = 1/);
  assert.match(fly, /memory = '2048mb'/);
});

test("admin product search returns every matching catalog product", async () => {
  const [admin, adminHtml] = await Promise.all([
    readFile("admin.js", "utf8"),
    readFile("admin.html", "utf8"),
  ]);
  const filterStart = admin.indexOf("function filteredAdminProducts()");
  const renderStart = admin.indexOf("function renderAdminProducts()");
  const loadStart = admin.indexOf("async function loadProducts()");
  const filterSource = admin.slice(filterStart, renderStart);
  const renderSource = admin.slice(renderStart, loadStart);
  assert.match(filterSource, /const terms = query\.split\(" "\)\.filter\(Boolean\)/);
  assert.match(filterSource, /terms\.every\(\(term\) => searchable\.includes\(term\)\)/);
  assert.doesNotMatch(filterSource, /\.slice\(0,\s*1\)/);
  assert.match(renderSource, /products\.map\(\(product\) =>/);
  assert.doesNotMatch(renderSource, /const product = products\[0\]/);
  assert.match(adminHtml, /Vengono mostrati tutti i prodotti corrispondenti/);
});

test("admin offers the three supported shoe size ranges", async () => {
  const [admin, adminHtml] = await Promise.all([
    readFile("admin.js", "utf8"),
    readFile("admin.html", "utf8"),
  ]);
  assert.match(adminHtml, /data-product-shoe-size-range/);
  assert.match(adminHtml, /value="36-41">36–41/);
  assert.match(adminHtml, /value="40-45">40–45/);
  assert.match(adminHtml, /value="36-45">36–45/);
  assert.match(admin, /"36-41": \["36", "37", "38", "39", "40", "41"\]/);
  assert.match(admin, /"40-45": \["40", "41", "42", "43", "44", "45"\]/);
  assert.match(admin, /"36-45": \["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"\]/);
  assert.match(admin, /productShoeSizeRange\?\.addEventListener\("change"/);
  assert.match(admin, /productForm\.elements\.sizes\.value = sizes\.join\(", "\)/);
});

test("clothing sizes stop at XXL throughout storefront and admin", async () => {
  const [script, admin, adminHtml, server] = await Promise.all([
    readFile("script.js", "utf8"),
    readFile("admin.js", "utf8"),
    readFile("admin.html", "utf8"),
    readFile("server.js", "utf8"),
  ]);
  assert.match(script, /const clothingSizes = \["S", "M", "L", "XL", "XXL"\]/);
  assert.match(admin, /clothing: \["S", "M", "L", "XL", "XXL"\]/);
  assert.match(adminHtml, /Abbigliamento S-XXL/);
  assert.doesNotMatch(adminHtml, /S-XXXL/);
  assert.match(server, /size\.toUpperCase\(\) !== "XXXL"/);
});

test("bags never expose or persist product sizes", async () => {
  const [script, admin, server] = await Promise.all([
    readFile("script.js", "utf8"),
    readFile("admin.js", "utf8"),
    readFile("server.js", "utf8"),
  ]);
  const storefrontSizesStart = script.indexOf("function getSizes(productOrSizeType)");
  const storefrontSizesEnd = script.indexOf("function createSizesMarkup", storefrontSizesStart);
  const storefrontSizes = script.slice(storefrontSizesStart, storefrontSizesEnd);
  assert.match(storefrontSizes, /const sizeType = resolveCatalogProductSizeType\(productOrSizeType\)/);
  assert.match(storefrontSizes, /if \(sizeType === "none"\)\s*\{\s*return \[\];\s*\}/);
  assert.ok(
    storefrontSizes.indexOf('if (sizeType === "none")') < storefrontSizes.indexOf("Array.isArray(productOrSizeType.sizes)"),
    "bag size detection must run before accepting explicit legacy sizes"
  );
  assert.match(admin, /const hasNoSizes = productForm\.elements\.sizeType\.value === "none"/);
  assert.match(admin, /productCustomSizesField\.hidden = isSneakers \|\| isJeans \|\| hasNoSizes/);
  assert.match(admin, /if \(hasNoSizes\)\s*\{[\s\S]*?productForm\.elements\.sizes\.value = ""/);
  assert.match(admin, /productForm\?\.elements\.name\?\.addEventListener\("input"/);
  assert.match(server, /const sizes = sizeType === "none"\s*\?\s*\[\]/);
  assert.match(server, /const inventoryBySize = sizeType === "none"\s*\?\s*\{\}/);
  assert.match(server, /const sizes = sizeType === "none"\s*\?\s*\[\][\s\S]*?cleanProductSizes\(publicProduct\.sizes\)/);
});

test("bags with one unit remain in the normal catalog", async () => {
  const [script, server, inventory] = await Promise.all([
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
    readFile("product-inventory.mjs", "utf8"),
  ]);
  assert.match(inventory, /export function isBagProduct/);
  assert.match(server, /const isBag = isBagProduct\(publicProduct\)/);
  assert.match(server, /isLastAvailable:\s*!isBag && inventoryTotal === 1/);
  assert.match(script, /function isCatalogBagProduct/);
  assert.match(script, /isLastAvailable:\s*!isBag && Boolean\(override\.isLastAvailable\)/);
  assert.match(script, /isLastAvailable:\s*!isBag && Boolean\(product\.isLastAvailable\)/);
});

test("checkout renders product images from the cart", async () => {
  const [checkout, script, styles] = await Promise.all([readFile("checkout.html", "utf8"), readFile("script.js", "utf8"), readFile("styles.css", "utf8")]);
  assert.match(checkout, /data-checkout-summary-products/);
  assert.match(script, /function renderCheckoutProductSummary\(\)/);
  assert.match(script, /function getCheckoutItemImage\(item\)/);
  assert.match(script, /function getCheckoutItemZoomImage\(item, previewImage\)/);
  assert.match(script, /function getCheckoutItemZoomGallery\(item, previewImage\)/);
  assert.match(script, /productZoomImageSource\(product, productImage, 0\)/);
  assert.match(script, /zoomImage:\s*productZoomImageSource\(product, productPrimaryImage\(product\), 0\)/);
  assert.match(script, /item\?\.zoomImage \|\| item\?\.tryOnImage \|\| previewImage/);
  assert.match(script, /data-product-zoom-open data-zoom-src=/);
  assert.match(script, /data-zoom-gallery=/);
  assert.match(script, /function navigateProductImageZoom\(direction\)/);
  assert.match(script, /data-product-zoom-previous/);
  assert.match(script, /data-product-zoom-next/);
  assert.match(script, /control\.dataset\.zoomGallery/);
  assert.match(script, /control\.dataset\.zoomFallback \|\| activeImage\?\.currentSrc/);
  assert.ok((script.match(/renderCheckoutProductSummary\(\);/g) || []).length >= 3);
  assert.match(script, /function removeCheckoutItem\(index\)/);
  assert.match(script, /data-checkout-remove-index/);
  assert.match(styles, /\.checkout-summary-product-image img\s*\{[\s\S]*?object-fit:\s*contain/);
  assert.match(styles, /\.checkout-summary-product-image\s*\{[\s\S]*?cursor:\s*zoom-in/);
  assert.match(styles, /\.checkout-summary-product-zoom-icon\s*\{/);
  assert.match(styles, /\.checkout-summary-remove\s*\{/);
  assert.match(styles, /\.product-image-zoom-nav\s*\{/);
  assert.match(styles, /\.product-image-zoom-counter\s*\{/);
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
  const zoomLoadStart = script.indexOf("function loadProductImageZoom(index");
  const zoomLoadEnd = script.indexOf("function navigateProductImageZoom", zoomLoadStart);
  const zoomLoadImplementation = script.slice(zoomLoadStart, zoomLoadEnd);
  assert.match(zoomLoadImplementation, /zoomImage\.removeAttribute\("srcset"\)/);
  assert.match(zoomLoadImplementation, /zoomImage\.src = source/);
  assert.match(zoomOpenImplementation, /control\.querySelector\("img"\)/);
  assert.match(zoomOpenImplementation, /const activeImageIndex = activeImage \? gallerySlides\.indexOf\(activeImage\) : -1/);
  assert.match(zoomOpenImplementation, /control\.hasAttribute\("data-zoom-index"\)/);
  assert.match(zoomOpenImplementation, /: activeImageIndex/);
  assert.doesNotMatch(zoomOpenImplementation, /control\.dataset\.zoomIndex \|\| "0"/);
  assert.match(zoomLoadImplementation, /zoomImage\.alt = entry\.alt \|\| ""/);
  assert.doesNotMatch(zoomLoadImplementation, /zoomImage\.src = previewSource/);
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
