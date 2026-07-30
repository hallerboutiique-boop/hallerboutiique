function cleanText(value, limit = 120) {
  return String(value || "").trim().slice(0, limit);
}

function normalizeComparable(value) {
  return cleanText(value).toLocaleLowerCase("it");
}

function productSizes(product) {
  const availableSizes = Array.isArray(product?.availableSizes) ? product.availableSizes : [];
  const sizes = availableSizes.length ? availableSizes : Array.isArray(product?.sizes) ? product.sizes : [];
  return sizes.map((size) => cleanText(size, 20)).filter(Boolean);
}

export function normalizeAuroraCheckoutItems(items, catalog) {
  if (!Array.isArray(items) || items.length > 20) return null;
  const productsById = new Map((Array.isArray(catalog) ? catalog : []).map((product) => [cleanText(product?.id), product]));
  const normalized = [];

  for (const item of items) {
    const productId = cleanText(item?.id);
    const product = productsById.get(productId);
    if (!product || product.isSoldOut) return null;
    const validSizes = productSizes(product);
    const requestedSize = cleanText(item?.size, 20);
    const selectedSize = validSizes.find((size) => normalizeComparable(size) === normalizeComparable(requestedSize));
    if (validSizes.length && !selectedSize) return null;
    normalized.push({ id: productId, size: selectedSize || "" });
  }

  return normalized;
}

export function normalizeAuroraCheckoutAction(action, catalog) {
  if (!action || typeof action !== "object") return null;
  if (action.mode === "unchanged") return { mode: "unchanged", items: [] };
  if (action.mode !== "replace") return null;
  const items = normalizeAuroraCheckoutItems(action.items, catalog);
  return items === null ? null : { mode: "replace", items };
}
