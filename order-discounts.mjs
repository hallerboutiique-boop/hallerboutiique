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
  const text = String(message || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it");
  const tenPercentMentioned = /(?:10\s*%|dieci\s*percento|ten\s*percent|dix\s*pour\s*cent|zehn\s*prozent|diez\s*por\s*ciento)/u.test(text);
  const discountMentioned = /(?:scont|codic|promo|riduz|discount|remise|rabatt|descuento|ulje|reducere)/u.test(text);
  return tenPercentMentioned && (discountMentioned || isDiscountApplicationRequest(message));
}

export function isDiscountApplicationRequest(message) {
  const text = String(message || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it");
  const actionRequested = /\b(?:applica|applicalo|applicamelo|applicami|applicarmelo|usa|usalo|metti|inserisci|inseriscilo|attiva|attivalo|apply|use|enter|activate|appliquer|utiliser|inserer|activer|anwenden|benutzen|eingeben|aktivieren|aplica|usar|introduce|activar|aplico|perdor|introdu|foloseste|activeaza)\b/u.test(text);
  const discountMentioned = /(?:\b(?:codic\w*|coupon|promo|scont\w*|code|discount|remise|rabatt|descuento|ulje|reducere)\b|10\s*%)/u.test(text);
  const refersToPreviousCode = /\b(?:applicalo|applicamelo|applicarmelo|usalo|inseriscilo|attivalo)\b/u.test(text);
  return actionRequested && (discountMentioned || refersToPreviousCode);
}

export function findUsableDiscountCodeInMessages(records, messages, now = new Date()) {
  const usableCodes = (Array.isArray(records) ? records : [])
    .filter((record) => discountCodeIsUsable(record, now))
    .map((record) => normalizeDiscountCode(record?.code))
    .filter(Boolean);

  for (const message of Array.isArray(messages) ? messages : []) {
    const text = String(message || "").toUpperCase();
    for (const code of usableCodes) {
      let index = text.indexOf(code);
      while (index !== -1) {
        const before = index > 0 ? text[index - 1] : "";
        const after = text[index + code.length] || "";
        if (!/[A-Z0-9]/u.test(before) && !/[A-Z0-9]/u.test(after)) return code;
        index = text.indexOf(code, index + 1);
      }
    }
  }
  return "";
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
