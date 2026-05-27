const NodeCache = require("node-cache");

// TTL values in seconds
const TTL = {
  OVERPASS: 60 * 60 * 24, // 24 h  — Overpass & GiveFood
  GIVEFOOD: 60 * 60 * 24, // 24 h
  TOILETMAP: 60 * 60 * 24 * 7, // 7 days — static dataset
};

/** @type {NodeCache | null} */
let cache = null;

function initCache() {
  cache = new NodeCache({
    stdTTL: TTL.OVERPASS,
    checkperiod: 600,
    useClones: false,
  });
  console.log("Node-Cache initialised");
}

function _getCache() {
  if (!cache) throw new Error("Cache not initialised — call initCache() first");
  return cache;
}

/**
 * Get a cached value.
 * @returns {{ value: any, ageS: number } | null}
 */
function cacheGet(key) {
  const c = _getCache();
  const value = c.get(key);
  if (value === undefined) return null;

  // Approximate age from remaining TTL
  const expiresAt = c.getTtl(key); // epoch ms when key expires
  const ageS = expiresAt
    ? Math.max(
        0,
        Math.round(c.options.stdTTL - (expiresAt - Date.now()) / 1000),
      )
    : 0;

  return { value, ageS };
}

/**
 * Set a cache value.
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlSeconds]  — defaults to stdTTL
 */
function cacheSet(key, value, ttlSeconds) {
  _getCache().set(key, value, ttlSeconds);
}

/** Delete a cache key. */
function cacheDel(key) {
  _getCache().del(key);
}

module.exports = { initCache, cacheGet, cacheSet, cacheDel, TTL };
