const axios = require("axios");
const { haversineDistance } = require("../utils/geo.js");

const BASE_URL = "https://www.givefood.org.uk/api/2";

// Ladywood centre coordinates and max radius in metres
const CENTRE = { lat: 52.483, lng: -1.913 };
const RADIUS = 5000;

// Map of GiveFood category IDs to our internal categories
function mapListItem(item) {
  const [lat, lng] = item.lat_lng.split(",").map(Number);

  // Normalise address to single line
  const address = item.address
    ? item.address.replace(/\s*\n\s*/g, ", ")
    : "Address unavailable";

  return {
    id: `givefood_${item.slug}`,
    name: item.name,
    type: "food_bank",
    lat,
    lng,
    address,
    opening_hours: null,
    notes: null,
    source: "givefood",
    lang: "en",
    extended: {
      needs: [],
      referral_required: null,
      phone: item.phone || null,
      url: item.urls?.homepage || null,
    },
  };
}

// Fetch and filter GiveFood data
async function fetch() {
  const url = `${BASE_URL}/foodbanks/`;
  const { data } = await axios.get(url, { timeout: 10000 });

  return data
    .filter((item) => item.closed === false)
    .map(mapListItem)
    .filter(
      (r) => haversineDistance(CENTRE.lat, CENTRE.lng, r.lat, r.lng) <= RADIUS,
    );
}

module.exports = { fetch };
