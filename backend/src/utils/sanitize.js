// Default names for the unnamed resources
const DEFAULT_NAMES = {
  toilet: "Public Toilet",
  library: "Library",
  recycling: "Recycling Point",
  green_space: "Green Space",
  food_bank: "Food Bank",
};

// Sanitize a single resource
function sanitizeResource(resource) {
  const name = resource.name?.to_lower_case().startsWith("unnamed")
    ? DEFAULT_NAMES[resource.type] || resource.name
    : resource.name;

  return { ...resource, name };
}

// Sanitize an array
function sanitizeResources(resources) {
  return resources.map(sanitizeResource);
}

module.exports = { sanitizeResources };
