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
  if (!response.ok) throw new Error(data.message || `${options.method || "GET"} ${path}: HTTP ${response.status}`);
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
const productsById = new Map(products.map((product) => [product.id, structuredClone(product)]));
const sneakerSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

// One exact size per last-stock shoe. A quantity of 1 makes each item visible
// only in Ultimi disponibili, while the size inventory keeps all other sizes unavailable.
const lastStockSizes = new Map([
  ["custom-new-balance-ms0zncnb", "40"],
  ["custom-nike-mrted7cr", "38"],
  ["custom-new-balance-ms0gc4wo", "43"],
  ["custom-louis-vuitton-trainer-ms0zit6d", "44"],
  ["custom-louis-vuitton-skete-verde-mrza3o2e", "42"],
  ["custom-nike-air-force-ms0glv9y", "44"],
  ["custom-nike-air-max-90-mrzbzdd1", "42"],
]);

const editableFields = [
  "id", "name", "brand", "description", "original", "finalPrice", "discount",
  "collection", "category", "sizeType", "sizes", "inventory", "inventoryBySize",
  "variantGroup", "variantColor", "variantSwatch", "variantOrder", "images",
  "originalImages", "zoomImages", "imageRenditions", "imageVariant",
];

const changedProducts = [...lastStockSizes].map(([id, availableSize]) => {
  const product = productsById.get(id);
  if (!product) throw new Error(`Scarpa ultimo disponibile mancante: ${id}`);
  if (product.sizeType !== "sneakers") throw new Error(`Il prodotto ${id} non e una scarpa.`);
  product.sizes = [...sneakerSizes];
  product.inventory = 1;
  product.inventoryBySize = Object.fromEntries(sneakerSizes.map((size) => [size, size === availableSize ? 1 : 0]));
  return product;
});

function productPayload(product) {
  return Object.fromEntries(editableFields
    .filter((field) => Object.hasOwn(product, field))
    .map((field) => [field, product[field]]));
}

if (applyChanges) {
  for (const product of changedProducts) {
    await request("/api/admin/products", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(productPayload(product)),
    });
  }
}

console.log(JSON.stringify({
  ok: true,
  applied: applyChanges,
  products: changedProducts.map((product) => ({
    id: product.id,
    name: product.name,
    availableSize: Object.entries(product.inventoryBySize)
      .find(([, quantity]) => quantity > 0)?.[0] || "",
  })),
}, null, 2));
