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
const changedIds = new Set();

function requireProduct(id) {
  const product = productsById.get(id);
  if (!product) throw new Error(`Prodotto mancante: ${id}`);
  return product;
}

function change(id, values) {
  const product = requireProduct(id);
  Object.assign(product, values);
  changedIds.add(id);
}

function setVariant(id, group, color, swatch, order, name) {
  change(id, {
    ...(name ? { name } : {}),
    variantGroup: group,
    variantColor: color,
    variantSwatch: swatch,
    variantOrder: order,
  });
}

change("custom-adidas-campus-mrzclhnu", { variantColor: "Bianco / Blu" });

change("denim-shorts-louis-vuitton", {
  name: "Jeans Louis Vuitton",
  category: "Jeans corti",
});
change("denim-shorts-gucci", {
  name: "Jeans Gucci",
  category: "Jeans corti",
});
change("ea7-red-shorts", { name: "Pantaloncino Emporio Armani" });

change("custom-completo-gucci-ms0g7jzi", {
  variantColor: "Bianco / Grigio",
  variantSwatch: "#b7b9ba",
});
change("custom-completo-gucci-ms0fdvjs", {
  variantColor: "Blu / Bianco",
  variantSwatch: "#294873",
});

change("two-piece-set-moschino", {
  name: "Completo Casual",
  sizeType: "clothing",
  sizes: ["XL"],
  inventory: null,
  inventoryBySize: {},
});

setVariant(
  "custom-louis-vuitton-trainer-ms0zit6d",
  "louis-vuitton-trainer-custom",
  "Bianco / Nero",
  "#202020",
  0,
  "Louis Vuitton Trainer"
);
setVariant(
  "custom-louis-vuitton-trainer-mrzan0ud",
  "louis-vuitton-trainer-custom",
  "Bianco / Rosa",
  "#eeb7c5",
  1,
  "Louis Vuitton Trainer"
);
setVariant(
  "louis-vuitton-trainer-white-black",
  "louis-vuitton-trainer-classic",
  "Bianco / Nero",
  "#202020",
  0,
  "Louis Vuitton Trainer"
);
setVariant(
  "louis-vuitton-trainer-white-pink",
  "louis-vuitton-trainer-classic",
  "Bianco / Rosa",
  "#eeb7c5",
  1,
  "Louis Vuitton Trainer"
);

const skateVariants = [
  ["louis-vuitton-skate-black-white", "Nero / Bianco", "#202020"],
  ["louis-vuitton-skate-beige-white", "Beige / Bianco", "#d2bea1"],
  ["louis-vuitton-skate-black-grey", "Nero / Grigio", "#4b4b4b"],
  ["louis-vuitton-skate-green", "Bianco / Verde", "#2d9a67"],
  ["louis-vuitton-skate-blue", "Blu / Bianco", "#385e95"],
  ["custom-louis-vuitton-skete-verde-mrza3o2e", "Nero / Bianco / Verde acqua", "#31a9a0"],
];
skateVariants.forEach(([id, color, swatch], order) => {
  setVariant(id, "louis-vuitton-skate", color, swatch, order, "Louis Vuitton Skate");
});

function isBagOrPochette(product) {
  const label = `${product.name || ""} ${product.collection || ""} ${product.category || ""}`.toLocaleLowerCase("it");
  if (/\b(?:wallet|portafogli[oa]?|card holder)\b/u.test(label)) return false;
  return /\b(?:bors[ae]|bags?|backpacks?|zain[oi]|pochette|pouches?|clutches?|crossbody|flap)\b/u.test(label);
}

const bagIds = products.filter(isBagOrPochette).map((product) => product.id);
bagIds.forEach((id) => {
  change(id, {
    sizeType: "none",
    sizes: [],
    inventory: 1,
    inventoryBySize: {},
  });
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

console.log(JSON.stringify({
  ok: true,
  applied: applyChanges,
  changedProducts: changedIds.size,
  bagsAndPochettes: bagIds.map((id) => ({
    id,
    name: productsById.get(id)?.name,
  })),
  keyProducts: [
    "custom-adidas-campus-mrzclhnu",
    "denim-shorts-louis-vuitton",
    "denim-shorts-gucci",
    "ea7-red-shorts",
    "custom-completo-gucci-ms0g7jzi",
    "custom-completo-gucci-ms0fdvjs",
    "two-piece-set-moschino",
    ...skateVariants.map(([id]) => id),
  ].map((id) => ({
    id,
    name: productsById.get(id)?.name,
    color: productsById.get(id)?.variantColor || "",
    sizes: productsById.get(id)?.sizes || [],
    images: productsById.get(id)?.images?.length || 0,
  })),
}, null, 2));
