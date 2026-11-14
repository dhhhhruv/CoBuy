// ============================================================================
// File: src/utils/geoUtils.js
// Owner: Dhruv (Database & Auth)
// Purpose: Spatial geometry validation, WKT formatting, and distance utilities.
// ============================================================================

/**
 * Validates GPS coordinates.
 * @param {number} latitude - WGS 84 latitude (-90 to +90)
 * @param {number} longitude - WGS 84 longitude (-180 to +180)
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCoordinates(latitude, longitude) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, error: 'Latitude and longitude must be valid numeric values' };
  }

  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and +90 degrees' };
  }

  if (lng < -180 || lng > 180) {
    return { valid: false, error: 'Longitude must be between -180 and +180 degrees' };
  }

  return { valid: true, lat, lng };
}

/**
 * Formats longitude and latitude into MySQL Well-Known Text (WKT) for POINT.
 * Viva Note: Standard WKT syntax for POINT is "POINT(longitude latitude)" (X Y order).
 * @param {number} longitude
 * @param {number} latitude
 * @returns {string} - e.g. "POINT(77.5946 12.9716)"
 */
function formatPointWKT(longitude, latitude) {
  return `POINT(${longitude} ${latitude})`;
}

/**
 * JavaScript implementation of Great-Circle Distance using Haversine formula.
 * Used for unit testing and offline verification against MySQL ST_Distance_Sphere.
 * @returns {number} distance in metres
 */
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Mean Earth radius in metres
  const toRad = deg => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = {
  validateCoordinates,
  formatPointWKT,
  haversineDistanceMeters
};

