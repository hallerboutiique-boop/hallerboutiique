import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizePhotonSuggestions,
  photonFeatureToAddress,
  validateCheckoutOrder,
} from "./checkout-address.mjs";

const photonFeature = {
  type: "Feature",
  properties: {
    osm_type: "N",
    osm_id: 2983282409,
    street: "Via Torino",
    housenumber: "10",
    city: "Milano",
    county: "Milano",
    state: "Lombardia",
    country: "Italia",
    postcode: "20123",
    countrycode: "IT",
  },
  geometry: { type: "Point", coordinates: [9.1856765, 45.4617728] },
};

test("normalizes complete Italian Photon results for checkout", () => {
  assert.deepEqual(photonFeatureToAddress(photonFeature), {
    id: "N2983282409",
    label: "Via Torino 10, 20123 Milano, Milano",
    address: "Via Torino 10",
    city: "Milano",
    postalCode: "20123",
    province: "Milano",
    country: "Italia",
    countryCode: "IT",
    latitude: 45.4617728,
    longitude: 9.1856765,
  });
  assert.equal(photonFeatureToAddress({ properties: { street: "Via Torino", countrycode: "IT" } }), null);
  assert.equal(normalizePhotonSuggestions({ features: [photonFeature, photonFeature] }).length, 1);
});

test("requires checkout contact and verified shipping fields but not a discount", () => {
  const order = {
    customer: {
      name: "Mario Rossi",
      phone: "+39 333 000 0000",
      email: "mario@example.com",
      address: "Via Torino 10",
      city: "Milano",
      postalCode: "20123",
      province: "Milano",
      country: "Italia",
      countryCode: "IT",
      addressVerified: true,
    },
    paymentMethod: "Contrassegno",
    products: [{ name: "Polo" }],
  };
  assert.deepEqual(validateCheckoutOrder(order), { ok: true, message: "" });
  assert.equal(validateCheckoutOrder({ ...order, customer: { ...order.customer, city: "" } }).ok, false);
  assert.equal(validateCheckoutOrder({ ...order, customer: { ...order.customer, addressVerified: false } }).ok, false);
  assert.equal(validateCheckoutOrder({ ...order, paymentMethod: "Crypto BTC", txHash: "" }).ok, false);
  assert.equal(validateCheckoutOrder({ ...order, paymentMethod: "Crypto BTC", txHash: "123456" }).ok, true);
});

test("checkout markup and server expose required autocomplete flow", async () => {
  const [checkout, script, server, styles] = await Promise.all([
    readFile("checkout.html", "utf8"),
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
    readFile("styles.css", "utf8"),
  ]);
  assert.match(checkout, /name="name"[^>]*required/);
  assert.match(checkout, /name="phone"[^>]*required/);
  assert.match(checkout, /name="email"[^>]*required/);
  assert.match(checkout, /name="address"[^>]*role="combobox"[^>]*required/);
  assert.match(checkout, /name="discount-code"(?![^>]*required)/);
  for (const field of ["city", "postal-code", "province", "country"]) {
    assert.match(checkout, new RegExp(`name="${field}"[^>]*readonly required`));
  }
  assert.match(checkout, /\/assets-v\/zoom-selected-image-1\/script\.js/);
  assert.match(checkout, /\/assets-v\/admin-original-price-5\/styles\.css/);
  assert.match(script, /function setupCheckoutAddressAutocomplete/);
  assert.match(script, /\/api\/address-suggestions\?q=/);
  assert.match(script, /addressVerified: Boolean\(selectedCheckoutAddress\)/);
  assert.match(server, /validateCheckoutOrder\(body\)/);
  assert.match(server, /url\.pathname === "\/api\/address-suggestions"/);
  assert.match(server, /countrycode", "IT"/);
  assert.match(styles, /\.address-suggestions\s*\{/);
});
