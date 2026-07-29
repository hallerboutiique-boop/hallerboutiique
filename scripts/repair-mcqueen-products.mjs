const siteUrl = String(process.env.SITE_URL || "https://www.hallerboutiique.com").replace(/\/+$/, "");
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const applyRepair = process.argv.includes("--apply");

if (!adminPassword) {
  throw new Error("ADMIN_PASSWORD non configurata.");
}

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

const catalog = await request("/api/admin/products", {
  headers: { cookie },
});
const productsById = new Map(
  (catalog.data.products || []).map((product) => [product.id, product])
);

const mcqueenIds = [
  "alexander-mcqueen-black-laces",
  "alexander-mcqueen-grey-white",
  "alexander-mcqueen-classic-white",
  "alexander-mcqueen-sky-blue",
  "alexander-mcqueen-classic",
  "alexander-mcqueen-grey-white-2",
  "alexander-mcqueen-classic-white-2",
  "alexander-mcqueen-sky-blue-2",
  "alexander-mcqueen-classic-2",
];

for (const id of mcqueenIds) {
  if (!productsById.has(id)) throw new Error(`Prodotto McQueen mancante: ${id}`);
}

function cloneGallery(targetId, sourceId) {
  const target = productsById.get(targetId);
  const source = productsById.get(sourceId);
  productsById.set(targetId, {
    ...target,
    images: [...(source.images || [])],
    originalImages: [...(source.originalImages || [])],
    zoomImages: [...(source.zoomImages || [])],
    imageRenditions: structuredClone(source.imageRenditions || {}),
    imageVariant: source.imageVariant || "cropped",
  });
}

// The black-heel gallery had been saved on the "Classic White" ID.
// Restore the original separate products without changing stock or prices.
cloneGallery("alexander-mcqueen-classic", "alexander-mcqueen-classic-white");
cloneGallery("alexander-mcqueen-classic-white", "alexander-mcqueen-classic-white-2");
cloneGallery("alexander-mcqueen-sky-blue-2", "alexander-mcqueen-sky-blue");

productsById.get("alexander-mcqueen-classic").name = "Alexander McQueen Classic";
productsById.get("alexander-mcqueen-classic-white").name = "Alexander McQueen Classic White";
productsById.get("alexander-mcqueen-sky-blue-2").name = "Alexander McQueen Sky Blue";

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

const repairs = mcqueenIds
  .map((id) => productsById.get(id))
  .filter((product) => product.variantColor || [
    "alexander-mcqueen-classic",
    "alexander-mcqueen-classic-white",
    "alexander-mcqueen-sky-blue-2",
  ].includes(product.id));

const summary = repairs.map((product) => ({
  id: product.id,
  name: product.name,
  collection: product.collection,
  images: product.images?.length || 0,
  inventory: product.inventory ?? null,
  action: applyRepair ? "updated" : "preview",
}));

if (applyRepair) {
  for (const product of repairs) {
    await request("/api/admin/products", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify(productPayload(product)),
    });
  }
}

console.log(JSON.stringify({
  ok: true,
  applied: applyRepair,
  products: summary,
}, null, 2));
