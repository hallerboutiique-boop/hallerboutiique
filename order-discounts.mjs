export const automaticDiscountThreshold = 399;
export const automaticDiscountPercentage = 15;
export const referralDiscountPercentage = 10;
export const maximumDiscountCodePercentage = 100;
export const referralCodeLength = 7;
export const referralCodeOrderExpiryMs = 24 * 60 * 60 * 1000;

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

export function normalizeDiscountCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, referralCodeLength);
}

export function calculateOrderDiscounts(subtotal, referralPercentage = 0) {
  const safeSubtotal = money(subtotal);
  const automaticDiscount = safeSubtotal > automaticDiscountThreshold
    ? money(safeSubtotal * automaticDiscountPercentage / 100)
    : 0;
  const safeReferralPercentage = Math.max(0, Math.min(maximumDiscountCodePercentage, Number(referralPercentage) || 0));
  const referralDiscount = safeReferralPercentage > 0
    ? money(safeSubtotal * safeReferralPercentage / 100)
    : 0;
  const total = money(Math.max(0, safeSubtotal - automaticDiscount - referralDiscount));
  return {
    subtotal: safeSubtotal,
    automaticPercentage: automaticDiscount > 0 ? automaticDiscountPercentage : 0,
    automaticDiscount,
    referralPercentage: referralDiscount > 0 ? safeReferralPercentage : 0,
    referralDiscount,
    total,
  };
}

export function isTenPercentDiscountRequest(message) {
  const text = String(message || "").toLocaleLowerCase("it");
  return /(?:10\s*%|diecis*percento)/u.test(text) && /(?:scont|codic|promo|riduz|discount)/u.test(text);
}

function titleCase(value) {
  return value
    .toLocaleLowerCase("it")
    .split(/\s+/u)
    .map((part) => part.charAt(0).toLocaleUpperCase("it") + part.slice(1))
    .join(" ");
}

export function extractReferralName(messages) {
  const text = (Array.isArray(messages) ? messages : [])
    .map((message) => String(message || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  const name = "([A-Za-zÀ-ÖØ-öø-ÿ'’-]{2,}(?:\\s+[A-Za-zÀ-ÖØ-öø-ÿ'’-]{2,}){1,2})";
  const patterns = [
    new RegExp(`(?:amico|amica|conoscente|referente)(?:\\s+(?:si\\s+chiama|di\\s+nome|è|e))?\\s*[:,-]?\\s*${name}`, "iu"),
    new RegExp(`${name}\\s+(?:mi\\s+ha\\s+(?:parlato|consigliato|fatto\\s+conoscere)|mi\\s+ha\\s+detto)`, "iu"),
    new RegExp(`(?:nome\\s+e\\s+cognome|referral)\\s*(?:è|e|:)?\\s*${name}`, "iu"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return titleCase(match[1].replace(/\s+/g, " ").trim());
  }
  return "";
}

export function discountCodeIsUsable(record, now = new Date()) {
  if (!record || record.status !== "issued" || record.orderId) return false;
  const expiresAt = new Date(record.expiresAt || "").getTime();
  return !Number.isFinite(expiresAt) || expiresAt > now.getTime();
}
