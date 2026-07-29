const productIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,139}$/;
const visitorHashPattern = /^[a-f0-9]{64}$/;

export function cleanLikeProductId(value) {
  const productId = String(value || "").trim();
  return productIdPattern.test(productId) ? productId : "";
}

export function normalizeProductLikes(value) {
  const source = value?.products && typeof value.products === "object" && !Array.isArray(value.products)
    ? value.products
    : {};
  const products = {};

  Object.entries(source).forEach(([rawProductId, rawVisitors]) => {
    const productId = cleanLikeProductId(rawProductId);
    if (!productId || !Array.isArray(rawVisitors)) return;
    const visitors = [...new Set(
      rawVisitors
        .map((visitor) => String(visitor || "").trim().toLowerCase())
        .filter((visitor) => visitorHashPattern.test(visitor))
    )];
    if (visitors.length) products[productId] = visitors;
  });

  return { products };
}

export function setProductLike(value, productIdValue, visitorHashValue, likedValue) {
  const productId = cleanLikeProductId(productIdValue);
  const visitorHash = String(visitorHashValue || "").trim().toLowerCase();
  if (!productId || !visitorHashPattern.test(visitorHash)) {
    throw new TypeError("Invalid product like identity.");
  }

  const store = normalizeProductLikes(value);
  const visitors = new Set(store.products[productId] || []);
  if (likedValue === true) visitors.add(visitorHash);
  else visitors.delete(visitorHash);

  if (visitors.size) store.products[productId] = [...visitors];
  else delete store.products[productId];

  return {
    store,
    productId,
    liked: visitors.has(visitorHash),
    count: visitors.size,
  };
}

export function summarizeProductLikes(value, visitorHashValue = "", allowedProductIds = null) {
  const store = normalizeProductLikes(value);
  const visitorHash = String(visitorHashValue || "").trim().toLowerCase();
  const allowed = allowedProductIds instanceof Set ? allowedProductIds : null;
  const counts = {};
  const likedProductIds = [];

  Object.entries(store.products).forEach(([productId, visitors]) => {
    if (allowed && !allowed.has(productId)) return;
    counts[productId] = visitors.length;
    if (visitorHashPattern.test(visitorHash) && visitors.includes(visitorHash)) {
      likedProductIds.push(productId);
    }
  });

  return { counts, likedProductIds };
}
