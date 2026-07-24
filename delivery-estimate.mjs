export const COURIER_ORIGIN = Object.freeze({
  name: "McDonald's Monza Viale Lombardia",
  address: "Viale Lombardia 175, 20900 Monza MB",
  latitude: 45.572012,
  longitude: 9.24744,
});

const earthRadiusKm = 6371.0088;
const minimumDeliveryMinutes = 5;
const maximumDeliveryMinutes = 7 * 24 * 60;

export function normalizeDeliveryCoordinate(value, minimum, maximum) {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) return null;
  return Number(coordinate.toFixed(7));
}

export function roundDeliveryMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.min(
    maximumDeliveryMinutes,
    Math.max(minimumDeliveryMinutes, Math.ceil(value / 5) * 5)
  );
}

export function routeDurationToDeliveryMinutes(durationSeconds) {
  return roundDeliveryMinutes(Number(durationSeconds) / 60);
}

export function haversineDistanceKm(origin, destination) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function fallbackDeliveryEstimate(destination) {
  const distanceKm = haversineDistanceKm(COURIER_ORIGIN, destination);
  const estimatedRoadDistanceKm = distanceKm * 1.3;
  const minutes = roundDeliveryMinutes((estimatedRoadDistanceKm / 32) * 60);
  return {
    minutes,
    distanceKm: Number(estimatedRoadDistanceKm.toFixed(1)),
    source: "geographic-fallback",
  };
}
