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
const productsById = new Map(products.map((product) => [product.id, structuredClone(product)]));
const sneakerSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

// These are the seven shoe cards that were in Ultimi disponibili before the
// temporary all-sizes reset. One total unit keeps them in that collection;
// no per-size stock is set so every standard size stays selectable until the
// final size inventory is supplied.
const lastStockShoeIds = [
  "custom-new-balance-ms0gc4wo",
  "custom-louis-vuitton-trainer-ms0zit6d",
  "custom-louis-vuitton-skete-verde-mrza3o2e",
  "custom-nike-air-force-ms0glv9y",
  "custom-nike-air-max-90-mrzbzdd1",
  "custom-new-balance-ms0zncnb",
  "custom-nike-mrted7cr",
];

const restored = lastStockShoeIds.map((id) => {
  const product = productsById.get(id);
  if (!product) throw new Error(`Scarpa ultimo disponibile mancante: ${id}`);
  if (product.sizeType !== "sneakers") throw new Error(`Il prodotto ${id} non e una scarpa.`);
  Object.assign(product, {
    sizes: [...sneakerSizes],
    inventory: 1,
    inventoryBySize: {},
  });
  return {
    id,
    name: product.name,
    collection: product.collection,
    category: product.category,
    images: product.images?.length || 0,
  };
});

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
  for (const id of lastStockShoeIds) {
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

console.log(JSON.stringify({
  ok: true,
  applied: applyChanges,
  restoredShoes: restored,
}, null, 2));
