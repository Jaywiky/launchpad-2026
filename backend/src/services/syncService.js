const pool = require("../../database/db");
const givefood = require("../apis/givefood");
const overpass = require("../apis/overpass");

const SOURCES = [
  { name: "givefood", ttl: 24 * 60 * 60 * 1000 },
  { name: "overpass", ttl: 24 * 60 * 60 * 1000 },
];

// Insert a single resource into DB
async function insertResource(client, resource) {
  const {
    id,
    name,
    type,
    lat,
    lng,
    address,
    opening_hours,
    notes,
    source,
    lang,
    extended,
  } = resource;

  await client.query(
    `INSERT INTO launchpad.resources
       (id, name, type, lat, lng, address, opening_hours, notes, source, lang, extended, cached_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name          = EXCLUDED.name,
       lat           = EXCLUDED.lat,
       lng           = EXCLUDED.lng,
       address       = EXCLUDED.address,
       opening_hours = EXCLUDED.opening_hours,
       notes         = EXCLUDED.notes,
       extended      = EXCLUDED.extended,
       cached_at     = NOW()`,
    [
      id,
      name,
      type,
      lat,
      lng,
      address,
      opening_hours,
      notes,
      source,
      lang,
      JSON.stringify(extended ?? {}),
    ],
  );
}

// Fetch from GiveFood API and enrich each record
async function fetchGiveFood() {
  const list = await givefood.fetch();
  console.log(`GiveFood: Fetched ${list.length} food banks, enriching.`);

  const enriched = await Promise.allSettled(
    list.map((item) => givefood.fetchById(item.id)),
  );

  return enriched.map((r, i) => {
    if (r.status === "fulfilled" && r.value) return r.value;
    console.warn(`GiveFood: Failed to enrich item ${list[i].id}`);
    return list[i]; // Return original item if enrichment fails
  });
}

// Fetch from Overpass API
async function fetchOverpass() {
  const list = await overpass.fetch();
  console.log(`Overpass: Fetched ${list.length} resources.`);
  return list;
}

// Check if resource needs update based on TTL
async function sourceNeedsUpdate(sourceName, ttl) {
  const { rows } = await pool.query(
    `SELECT MAX(cached_at) AS last_sync
     FROM launchpad.resources
     WHERE source = $1`,
    [sourceName],
  );

  const lastSync = rows[0]?.last_sync;
  if (!lastSync) return true;
  return Date.now() - new Date(lastSync.getTime()) > ttl;
}

// Sync a single source
async function syncSource(sourceName) {
  console.log(`Syncing source: ${sourceName}`);
  let start = Date.now();

  const resources =
    sourceName === "givefood" ? await fetchGiveFood() : await fetchOverpass();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const resource of resources) {
      await insertResource(client, resource);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Syncing source: ${sourceName} completed in ${elapsed} seconds`);
}

// Boot sync - runs on server start up
async function bootSync() {
  console.log("Starting boot sync...");
  for (const source of SOURCES) {
    try {
      const needsUpdate = await sourceNeedsUpdate(source.name, source.ttl);
      if (needsUpdate) {
        await syncSource(source.name);
      } else {
        console.log(`Source ${source.name} is up to date, skipping sync.`);
      }
    } catch (err) {
      console.error(`Boot sync failed for source ${source.name}:`, err.message);
    }
  }
  console.log("Boot sync completed.");
}

// Scheduled sync
async function scheduledSync() {
  console.log("Running scheduled sync...");
  for (const source of SOURCES) {
    try {
      const needsRefresh = await sourceNeedsUpdate(source.name, source.ttl);
      if (needsRefresh) await syncSource(source.name);
    } catch (err) {
      console.error(
        `Scheduled sync failed for source ${source.name}:`,
        err.message,
      );
    }
  }
}

module.exports = {
  bootSync,
  scheduledSync,
};
