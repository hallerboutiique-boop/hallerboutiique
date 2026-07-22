function compact(value, max = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function photonFeatureToAddress(feature) {
  const properties = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
  const coordinates = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : [];
  const street = compact(properties.street || properties.name, 140);
  const houseNumber = compact(properties.housenumber, 30);
  const address = compact([street, houseNumber].filter(Boolean).join(" "), 180);
  const city = compact(
    properties.city || properties.town || properties.village || properties.locality || properties.county,
    80
  );
  const postalCode = compact(properties.postcode, 20);
  const province = compact(properties.county || properties.state, 80);
  const country = compact(properties.country || "Italia", 80);
  const countryCode = compact(properties.countrycode || "IT", 8).toUpperCase();
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);

  if (!address || !city || !postalCode || countryCode !== "IT") return null;

  return {
    id: compact(`${properties.osm_type || ""}${properties.osm_id || ""}`, 80),
    label: compact([address, [postalCode, city].filter(Boolean).join(" "), province].filter(Boolean).join(", "), 260),
    address,
    city,
    postalCode,
    province,
    country,
    countryCode,
    ...(Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : {}),
  };
}

export function normalizePhotonSuggestions(payload, limit = 6) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const seen = new Set();
  const suggestions = [];

  for (const feature of features) {
    const suggestion = photonFeatureToAddress(feature);
    if (!suggestion) continue;
    const key = `${suggestion.address}|${suggestion.postalCode}|${suggestion.city}`.toLocaleLowerCase("it");
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
    if (suggestions.length >= limit) break;
  }

  return suggestions;
}

export function validateCheckoutOrder(body) {
  const customer = body?.customer && typeof body.customer === "object" ? body.customer : {};
  const required = [
    ["name", 2, "Inserisci nome e cognome."],
    ["phone", 6, "Inserisci un numero di telefono valido."],
    ["email", 5, "Inserisci un indirizzo email valido."],
    ["address", 5, "Seleziona un indirizzo completo dai suggerimenti."],
    ["city", 2, "Seleziona un indirizzo completo di città."],
    ["postalCode", 5, "Seleziona un indirizzo completo di CAP."],
    ["province", 2, "Seleziona un indirizzo completo di provincia."],
    ["country", 2, "Seleziona un indirizzo completo di Paese."],
  ];

  for (const [field, minimum, message] of required) {
    if (compact(customer[field], 200).length < minimum) return { ok: false, message };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(compact(customer.email, 180))) {
    return { ok: false, message: "Inserisci un indirizzo email valido." };
  }
  if (compact(customer.phone, 60).replace(/\D/g, "").length < 6) {
    return { ok: false, message: "Inserisci un numero di telefono valido." };
  }
  if (!/^\d{5}$/.test(compact(customer.postalCode, 20))) {
    return { ok: false, message: "Il CAP deve contenere 5 cifre." };
  }
  if (compact(customer.countryCode, 8).toUpperCase() !== "IT" || customer.addressVerified !== true) {
    return { ok: false, message: "Seleziona un indirizzo italiano dai suggerimenti." };
  }

  const products = Array.isArray(body?.products || body?.items) ? (body.products || body.items) : [];
  if (products.length === 0) return { ok: false, message: "Il carrello è vuoto." };

  if (/crypto/i.test(compact(body?.paymentMethod, 80)) && compact(body?.txHash, 180).length < 6) {
    return { ok: false, message: "Inserisci il TX hash del pagamento crypto." };
  }

  return { ok: true, message: "" };
}
