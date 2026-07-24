import assert from "node:assert/strict";
import test from "node:test";
import {
  COURIER_ORIGIN,
  fallbackDeliveryEstimate,
  normalizeDeliveryCoordinate,
  roundDeliveryMinutes,
  routeDurationToDeliveryMinutes,
} from "./delivery-estimate.mjs";

test("uses McDonald's Monza Viale Lombardia as the courier origin", () => {
  assert.equal(COURIER_ORIGIN.address, "Viale Lombardia 175, 20900 Monza MB");
  assert.equal(COURIER_ORIGIN.latitude, 45.572012);
  assert.equal(COURIER_ORIGIN.longitude, 9.24744);
});

test("normalizes visitor coordinates and rejects invalid values", () => {
  assert.equal(normalizeDeliveryCoordinate("45.46421191", -90, 90), 45.4642119);
  assert.equal(normalizeDeliveryCoordinate("9.19002", -180, 180), 9.19002);
  assert.equal(normalizeDeliveryCoordinate("91", -90, 90), null);
  assert.equal(normalizeDeliveryCoordinate("not-a-coordinate", -180, 180), null);
});

test("rounds road duration up and writes a practical minute estimate", () => {
  assert.equal(routeDurationToDeliveryMinutes(1), 5);
  assert.equal(routeDurationToDeliveryMinutes(60 * 57), 60);
  assert.equal(roundDeliveryMinutes(61), 65);
});

test("provides a position-based fallback when road routing is unavailable", () => {
  const estimate = fallbackDeliveryEstimate({ latitude: 45.4642, longitude: 9.19 });
  assert.equal(estimate.source, "geographic-fallback");
  assert.ok(estimate.minutes >= 20);
  assert.ok(estimate.distanceKm > 10);
});
