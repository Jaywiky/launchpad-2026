const axios = require("axios");

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Ladywood centre coordinates and max radius in metres
const CENTRE = { lat: 52.483, lng: -1.913 };
const RADIUS = 5000;

const HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "LadywoodResourceFinder/1.0 (university project)",
  Referer: "https://github.com/Jaywiky/launchpad-2026",
};

const RESTRICTED_ACCESS = ["private", "customers", "employees"];

// Query to fetch toilets, libraries, recycling points, and green spaces around Ladywood
const buildQuery = () => `
  [out:json][timeout:60];
  (
    node["amenity"="toilets"](around:${RADIUS},${CENTRE.lat},${CENTRE.lng});
    way["amenity"="toilets"](around:${RADIUS},${CENTRE.lat},${CENTRE.lng});
    node["amenity"="library"](around:${RADIUS},${CENTRE.lat},${CENTRE.lng});
    way["amenity"="library"](around:${RADIUS},${CENTRE.lat},${CENTRE.lng});
    node["amenity"="recycling"](around:${RADIUS},${CENTRE.lat},${CENTRE.lng});
    way["amenity"="recycling"](around:${RADIUS},${CENTRE.lat},${CENTRE.lng});
    node["leisure"~"park|garden|nature_reserve"](around:${RADIUS},${CENTRE.lat},${CENTRE.lng});
    way["leisure"~"park|garden|nature_reserve"](around:${RADIUS},${CENTRE.lat},${CENTRE.lng});
  );
    out center;
  `;

// Build address from OSM tags
function buildAddress(tags) {
  if (tags["addr:full"]) return tags["addr:full"];
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"] || "Birmingham",
  ].filter(Boolean);
  return parts.length >= 2 ? parts.join(", ") : "Address unavailable";
}

// Build extended properties based on type and tags
function buildExtended(type, tags) {
  switch (type) {
    case "library":
      return {
        operator: tags.operator || null,
        wifi: tags["internet_access"]
          ? ["wlan", "yes"].includes(tags["internet_access"])
          : null,
        computers: tags["computer"] === "yes" ? true : null,
        wheelchair: tags.wheelchair || null,
      };

    case "recycling":
      return {
        accepts: Object.keys(tags)
          .filter((k) => k.startsWith("recycling:") && tags[k] === "yes")
          .map((k) => k.replace("recycling:", "")),
        operator: tags.operator || null,
      };

    case "toilet":
      return {
        accessible:
          tags.wheelchair === "yes"
            ? true
            : tags.wheelchair === "no"
              ? false
              : null,
        baby_change: tags["changing_table"] === "yes" ? true : null,
        radar_key: tags["centralkey"] === "RADAR" ? true : null,
        fee: tags.fee === "no" ? null : tags.fee || null,
        men: tags.male === "yes" ? true : null,
        women: tags.female === "yes" ? true : null,
        unisex: tags.unisex === "yes" ? true : null,
      };

    case "green_space":
      return {
        area_m2: null,
        leisure: tags.leisure || null,
        wheelchair: tags.wheelchair || null,
        dog_friendly:
          tags.dog === "yes" ? true : tags.dog === "no" ? false : null,
      };

    default:
      return {};
  }
}

// Determine type based on tags
function getType(tags) {
  if (tags.amenity === "toilets") return "toilet";
  if (tags.amenity === "library") return "library";
  if (tags.amenity === "recycling") return "recycling";
  if (tags.leisure) return "green_space";
  return null;
}

// Validate element through filters
function isValid(tags) {
  if (RESTRICTED_ACCESS.includes(tags.access)) return false;
  if (tags.status === "disused") return false;
  if (tags.leisure === "garden" && !tags.name) return false;
  if (tags.amenity === "recycling") {
    const hasAccepts = Object.keys(tags).some(
      (k) => k.startsWith("recycling:") && tags[k] === "yes",
    );
    if (!hasAccepts) return false;
  }
  return true;
}

// Map Overpass element to our internal format
function mapElement(element) {
  const lat = element.lat ?? element.center?.lat ?? null;
  const lng = element.lon ?? element.center?.lon ?? null;
  const tags = element.tags || {};
  const type = getType(tags);

  const name =
    tags.name || tags.operator || `Unnamed ${type.replace("_", " ")}`;

  return {
    id: `overpass_${element.id}`,
    name,
    type,
    lat,
    lng,
    address: buildAddress(tags),
    opening_hours: tags.opening_hours || null,
    notes: tags.description || null,
    source: "overpass",
    lang: "en",
    extended: buildExtended(type, tags),
  };
}

// Fetch and filter Overpass data
async function fetch() {
  const { data } = await axios.post(
    OVERPASS_URL,
    `data=${encodeURIComponent(buildQuery())}`,
    { headers: HEADERS, timeout: 60000 },
  );

  return (data?.elements ?? [])
    .filter((el) => isValid(el.tags || {}))
    .map(mapElement)
    .filter((r) => r.type !== null);
}

module.exports = { fetch };
