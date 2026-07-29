const siteUrl = String(process.env.SITE_URL || "https://www.hallerboutiique.com").replace(/\/+$/, "");
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const applyChanges = process.argv.includes("--apply");

if (!adminPassword) throw new Error("ADMIN_PASSWORD non configurata.");

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    signal: AbortSignal.timeout(30000),
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `${options.method || "GET"} ${path}: HTTP ${response.status}`);
  }
  return { data, response };
}

const login = await request("/api/admin/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: adminPassword }),
});
const cookie = String(login.response.headers.get("set-cookie") || "").split(";")[0];
if (!cookie) throw new Error("Il login admin non ha restituito una sessione.");

const catalog = await request("/api/admin/products", { headers: { cookie } });
const products = Array.isArray(catalog.data.products) ? catalog.data.products : [];
const originalProductsById = new Map(products.map((product) => [product.id, structuredClone(product)]));
const productsById = new Map(products.map((product) => [product.id, structuredClone(product)]));
const changedIds = new Set();
const sizeUpdatedIds = new Set();

const standardSizes = Object.freeze({
  clothing: ["S", "M", "L", "XL", "XXL"],
  sneakers: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
  jeans: ["40", "42", "44", "46", "48", "50", "52", "54", "56"],
});

const translatedNames = new Map(Object.entries({
  "jacket-stone-island": "Giacca Stone Island",
  "jacket-balenciaga": "Giacca Balenciaga",
  "nike-shox-full-black": "Nike Shox Nere",
  "nike-tn-full-black": "Nike TN Nere",
  "nike-tn-full-white": "Nike TN Bianche",
  "nike-air-force-black-white": "Nike Air Force Nere/Bianche",
  "nike-air-force-full-white": "Nike Air Force Tutte Bianche",
  "nike-air-force-louis-vuitton-red": "Nike Air Force Louis Vuitton Rosse",
  "nike-air-force-chunky-laces": "Nike Air Force con Lacci Spessi",
  "gucci-ace-green-red": "Gucci Ace Verde/Rosso",
  "balenciaga-track-full-black": "Balenciaga Track Nere",
  "alexander-mcqueen-black-laces": "Alexander McQueen con Lacci Neri",
  "alexander-mcqueen-grey-white": "Alexander McQueen Grigio/Bianco",
  "alexander-mcqueen-grey-white-2": "Alexander McQueen Grigio/Bianco",
  "alexander-mcqueen-classic-white": "Alexander McQueen Classica Bianca",
  "alexander-mcqueen-classic-white-2": "Alexander McQueen Classica Bianca",
  "alexander-mcqueen-sky-blue-2": "Alexander McQueen Azzurra",
  "alexander-mcqueen-classic": "Alexander McQueen Classica",
  "alexander-mcqueen-classic-2": "Alexander McQueen Classica",
  "gucci-high-top-gg-supreme-beige-green-red": "Gucci Sneakers Alte GG Supreme Beige/Verde/Rosso",
  "bag-louis-vuitton": "Borsa Louis Vuitton",
  "backpack-louis-vuitton": "Zaino Louis Vuitton",
  "flap-bag-chanel": "Borsa con Patta Chanel",
}));

function productInventoryTotal(product) {
  const quantities = Object.values(product.inventoryBySize || {});
  if (quantities.length) {
    return quantities.reduce((total, quantity) => total + Math.max(0, Number(quantity) || 0), 0);
  }
  if (product.inventory === "" || product.inventory === null || product.inventory === undefined) return null;
  const inventory = Number(product.inventory);
  return Number.isFinite(inventory) ? inventory : null;
}

function isExplicitlySoldOut(product) {
  return productInventoryTotal(product) === 0;
}

function markChanged(product, values, options = {}) {
  Object.assign(product, values);
  changedIds.add(product.id);
  if (options.sizes) sizeUpdatedIds.add(product.id);
}

[...productsById.values()].forEach((product) => {
  const translatedName = translatedNames.get(product.id);
  const category = product.id === "tracksuit-polo-ralph-lauren" ? "Tuta" : product.category;
  const sizes = standardSizes[product.sizeType];
  const shouldEnableAllSizes = Boolean(sizes) && !isExplicitlySoldOut(product);
  const values = {
    ...(translatedName ? { name: translatedName } : {}),
    ...(category !== product.category ? { category } : {}),
    ...(shouldEnableAllSizes ? {
      sizes: [...sizes],
      inventory: null,
      inventoryBySize: {},
    } : {}),
  };
  if (Object.keys(values).length) {
    markChanged(product, values, { sizes: shouldEnableAllSizes });
  }
});

for (const id of translatedNames.keys()) {
  if (!productsById.has(id)) throw new Error(`Prodotto da tradurre mancante: ${id}`);
}

const editableFields = [
  "id",
  "name",
  "brand",
  "description",
  "original",
  "finalPrice",
  "discount",
  "collection",
  "category",
  "sizeType",
  "sizes",
  "inventory",
  "inventoryBySize",
  "variantGroup",
  "variantColor",
  "variantSwatch",
  "variantOrder",
  "images",
  "originalImages",
  "zoomImages",
  "imageRenditions",
  "imageVariant",
];

function productPayload(product) {
  return Object.fromEntries(
    editableFields
      .filter((field) => Object.hasOwn(product, field))
      .map((field) => [field, product[field]])
  );
}

if (applyChanges) {
  for (const id of changedIds) {
    await request("/api/admin/products", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify(productPayload(productsById.get(id))),
    });
  }
}

const translated = [...translatedNames].map(([id, name]) => ({
  id,
  before: originalProductsById.get(id)?.name || "",
  after: name,
  images: productsById.get(id)?.images?.length || 0,
}));
const soldOut = [...originalProductsById.values()].filter(isExplicitlySoldOut).map((product) => ({
  id: product.id,
  name: productsById.get(product.id)?.name || product.name,
  inventory: productInventoryTotal(product),
}));

console.log(JSON.stringify({
  ok: true,
  applied: applyChanges,
  totalProducts: products.length,
  changedProducts: changedIds.size,
  productsWithAllSizes: sizeUpdatedIds.size,
  translatedProducts: translated.length,
  translated,
  preservedSoldOutProducts: soldOut,
}, null, 2));
