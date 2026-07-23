function cleanSize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 12);
}

function cleanQuantity(value) {
  if (value === "" || value === null || value === undefined) return null;
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 0 ? quantity : null;
}

export const defaultProductSizes = {
  clothing: ["S", "M", "L", "XL", "XXL", "XXXL"],
  sneakers: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
  none: [],
};

export function resolveProductSizeType({ collection = "", category = "", sizeType = "" } = {}) {
  const label = `${collection} ${category}`.toLocaleLowerCase("it");
  if (/\b(?:scarp[ae]|sneakers?|shoes?|boots?|stivali?)\b/u.test(label)) return "sneakers";
  if (/\b(?:bors[ae]|bag|wallet|portafogli[oa]?|card holder|backpack|zain[oi]|cintur[ae]|accessori?)\b/u.test(label)) return "none";
  return "clothing";
}

export function normalizeInventoryBySize(value, sizes = []) {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = {};
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};

  const allowedSizes = [...new Set((Array.isArray(sizes) ? sizes : []).map(cleanSize).filter(Boolean))];
  const allowedByLowercase = new Map(allowedSizes.map((size) => [size.toLocaleLowerCase("it"), size]));
  const normalized = {};

  Object.entries(source).forEach(([rawSize, rawQuantity]) => {
    const cleanedSize = cleanSize(rawSize);
    const size = allowedSizes.length
      ? allowedByLowercase.get(cleanedSize.toLocaleLowerCase("it"))
      : cleanedSize;
    const quantity = cleanQuantity(rawQuantity);
    if (!size || quantity === null) return;
    normalized[size] = quantity;
  });

  return normalized;
}

export function inventoryBySizeTotal(inventoryBySize) {
  const values = Object.values(normalizeInventoryBySize(inventoryBySize));
  return values.length ? values.reduce((total, quantity) => total + quantity, 0) : null;
}

export function productInventoryTotal(product) {
  const bySizeTotal = inventoryBySizeTotal(product?.inventoryBySize);
  if (bySizeTotal !== null) return bySizeTotal;
  return cleanQuantity(product?.inventory);
}

export function availableInventorySizes(product) {
  return Object.entries(normalizeInventoryBySize(product?.inventoryBySize))
    .filter(([, quantity]) => quantity > 0)
    .map(([size]) => size);
}

export function adjustProductInventory(product, ordered, direction = -1) {
  if (!product || !ordered) return false;
  const quantity = Math.max(1, Number.parseInt(ordered.quantity || 1, 10) || 1);
  const inventoryBySize = normalizeInventoryBySize(product.inventoryBySize);
  const inventorySizes = Object.keys(inventoryBySize);

  if (inventorySizes.length) {
    const requestedSize = cleanSize(ordered.size || ordered.variant).toLocaleLowerCase("it");
    const size = inventorySizes.find((entry) => entry.toLocaleLowerCase("it") === requestedSize);
    if (!size) return false;
    if (direction < 0 && inventoryBySize[size] < quantity) return false;
    inventoryBySize[size] = direction < 0
      ? inventoryBySize[size] - quantity
      : inventoryBySize[size] + quantity;
    product.inventoryBySize = inventoryBySize;
    product.inventory = inventoryBySizeTotal(inventoryBySize);
    return true;
  }

  const total = cleanQuantity(product.inventory);
  if (total === null) return false;
  if (direction < 0 && total < quantity) return false;
  product.inventory = direction < 0 ? total - quantity : total + quantity;
  return true;
}
