import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlFiles = ["index.html", "account.html", "checkout.html", "ultimi-disponibili.html", "spedizioni.html", "termini.html", "privacy.html", "admin.html"];

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
  assert.match(checkout, /script\.js\?v=checkout-product-summary-1/);
  assert.match(script, /function createBundleTryOnReference/);
  assert.match(script, /formData\.append\("mode", "bundle"\)/);
  assert.match(script, /formData\.append\("bundleItems", JSON\.stringify\(bundleData\)\)/);
  for (const language of ["it", "en", "fr", "de", "es"]) {
    assert.match(script, new RegExp(`\\n  ${language}: \\{[\\s\\S]*?"bundle-tryon-title"`));
  }
});

test("catalog navigation, visual search and private last-stock handling are present", async () => {
  const [index, lastStock, admin, script, server] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("ultimi-disponibili.html", "utf8"),
    readFile("admin.html", "utf8"),
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
  ]);
  assert.match(index, /data-catalog-nav-toggle="uomo"/);
  assert.match(index, /data-catalog-nav-toggle="donna"/);
  assert.match(index, /ultimi-disponibili\.html/);
  assert.match(lastStock, /data-last-stock-catalog/);
  assert.match(script, /function renderCatalogNavigation\(\)/);
  assert.match(script, /function ensureCatalogSearch\(\)/);
  assert.match(script, /function renderLastStockCatalog\(\)/);
  assert.match(script, /isLastAvailable/);
  assert.match(admin, /name="sizes"/);
  assert.match(admin, /name="inventory"/);
  assert.match(server, /function cleanProductInventory/);
  assert.match(server, /const \{ inventory, \.\.\.publicProduct \}/);
  assert.match(server, /async function reduceProductInventory/);
});

test("try-on supports clothing, shoes and bags", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.doesNotMatch(script, /product\.sizeType !== "clothing"/);
  assert.match(script, /image: productPrimaryImage\(product\)/);
  assert.match(server, /function cleanTryOnBundleItems/);
  assert.match(server, /put sneakers or shoes on the feet/);
  assert.match(server, /place bags in the customer's hand/);
  assert.match(server, /Do not omit, replace or duplicate any numbered item/);
});

test("product images keep their full composition", async () => {
  const [styles, admin] = await Promise.all([readFile("styles.css", "utf8"), readFile("admin.js", "utf8")]);
  assert.match(styles, /\.product-image\s*\{[\s\S]*?object-fit:\s*contain/);
  assert.match(styles, /\.catalog-search-preview img[\s\S]*?object-fit:\s*contain/);
  assert.match(admin, /async function uploadProductImageFiles\(files, productId\)/);
  assert.match(admin, /formData\.append\("images", file, filename\)/);
  assert.match(admin, /uploadProductImageFiles\(files, productId\)/);
});

test("checkout renders product images from the cart", async () => {
  const [checkout, script, styles] = await Promise.all([readFile("checkout.html", "utf8"), readFile("script.js", "utf8"), readFile("styles.css", "utf8")]);
  assert.match(checkout, /data-checkout-summary-products/);
  assert.match(script, /function renderCheckoutProductSummary\(\)/);
  assert.match(script, /function getCheckoutItemImage\(item\)/);
  assert.match(script, /renderCheckoutProductSummary\(\);/);
  assert.match(styles, /\.checkout-summary-product-image img\s*\{[\s\S]*?object-fit:\s*contain/);
});
