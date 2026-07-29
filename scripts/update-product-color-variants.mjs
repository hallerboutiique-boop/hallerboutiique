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

const updates = new Map([
  // Trainers must stay distinct: black/white for men and pink/white for women.
  ["custom-louis-vuitton-trainer-ms0zit6d", {
    variantGroup: "",
    variantColor: "",
    variantSwatch: "",
    variantOrder: 0,
  }],
  ["custom-louis-vuitton-trainer-mrzan0ud", {
    variantGroup: "",
    variantColor: "",
    variantSwatch: "",
    variantOrder: 0,
  }],
  ["louis-vuitton-trainer-white-black", {
    variantGroup: "",
    variantColor: "",
    variantSwatch: "",
    variantOrder: 0,
  }],
  ["louis-vuitton-trainer-white-pink", {
    variantGroup: "",
    variantColor: "",
    variantSwatch: "",
    variantOrder: 0,
  }],
  // The Nike TN remains one product card with a clean black/white selector.
  ["nike-tn-full-black", {
    name: "Nike TN",
    variantGroup: "nike-tn-colori",
    variantColor: "Nero",
    variantSwatch: "#202020",
    variantOrder: 0,
  }],
  ["nike-tn-full-white", {
    name: "Nike TN",
    variantGroup: "nike-tn-colori",
    variantColor: "Bianco",
    variantSwatch: "#f5f5f5",
    variantOrder: 1,
  }],
  // New Balance colors must remain separate cards in their respective gender sections.
  ["custom-new-balance-ms0zncnb", {
    variantGroup: "",
    variantColor: "",
    variantSwatch: "",
    variantOrder: 0,
  }],
  ["custom-new-balance-ms0gc4wo", {
    variantGroup: "",
    variantColor: "",
    variantSwatch: "",
    variantOrder: 0,
  }],
]);

const editableFields = [
  "id", "name", "brand", "description", "original", "finalPrice", "discount",
  "collection", "category", "sizeType", "sizes", "inventory", "inventoryBySize",
  "variantGroup", "variantColor", "variantSwatch", "variantOrder", "images",
  "originalImages", "zoomImages", "imageRenditions", "imageVariant",
];

const changedProducts = [...updates].map(([id, update]) => {
  const product = productsById.get(id);
  if (!product) throw new Error(`Prodotto non trovato: ${id}`);
  Object.assign(product, update);
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
    collection: product.collection,
    variantGroup: product.variantGroup,
    variantColor: product.variantColor,
  })),
}, null, 2));
