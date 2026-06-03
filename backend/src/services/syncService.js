const pool = require("../../database/db");
const givefood = require("../apis/givefood");
const overpass = require("../apis/overpass");
const { buildManifest } = require("./manifestService");
const { extractTranslations } = require("../utils/translationExtractor");
const { translate } = require('@vitalets/google-translate-api');

const SOURCES = [
  { name: "givefood", ttl: 24 * 60 * 60 * 1000 },
  { name: "overpass", ttl: 24 * 60 * 60 * 1000 },
];


const delay = ms => new Promise(res => setTimeout(res, ms));

async function upsertTranslations(client, store) {
  const hashes = Object.keys(store)
  if (hashes.length === 0) return

  const { rows } = await client.query(
    `SELECT hash FROM launchpad.data_translations WHERE hash = ANY($1::text[])`,
    [hashes]
  )
  const existingHashes = new Set(rows.map(r => r.hash))

  console.log(`Extractor: Upserting ${hashes.length} strings (${hashes.length - existingHashes.size} are new and need translation).`)

  for (const hash of hashes) {
    const enText = store[hash].en
    const typesArray = Array.from(store[hash].types)
    let translationsJson;

    if (!existingHashes.has(hash)) {
      let plText = enText
      let urText = enText

      try {
        console.log(`Translating new string: "${enText.substring(0, 30)}..."`)

        plText = (await translate(enText, { to: 'pl' })).text
        await delay(500)
        urText = (await translate(enText, { to: 'ur' })).text
        await delay(500);

      } catch (err) { console.error(`Translation failed for hash ${hash}:`, err.message) }

      translationsJson = { en: enText, pl: plText, ur: urText }
    }
    else { translationsJson = { en: enText } }

    await client.query(
      `INSERT INTO launchpad.data_translations (hash, translations, used_in_types)
       VALUES ($1, $2::jsonb, $3::text[])
       ON CONFLICT (hash) DO UPDATE SET 
         used_in_types = ARRAY(
           SELECT DISTINCT UNNEST(launchpad.data_translations.used_in_types || EXCLUDED.used_in_types)
         )`,
      [hash, JSON.stringify(translationsJson), typesArray]
    );
  }
}

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
    extended,
  } = resource;

  await client.query(
    `INSERT INTO launchpad.resources
       (id, name, type, lat, lng, address, opening_hours, notes, source, extended, cached_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
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
      JSON.stringify(extended ?? {}),
    ]
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

  const store = {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let resource of resources) {
      resource = extractTranslations(resource, store)
      await insertResource(client, resource)
    }
    await upsertTranslations(client, store)
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

async function refreshSources() {
  let synced = false;
  for (const source of SOURCES) {
    try {
      if (await sourceNeedsUpdate(source.name, source.ttl)) {
        await syncSource(source.name);
        synced = true;
      } else {
        console.log(`Source ${source.name} is up to date, skipping sync.`);
      }
    } catch (err) {
      console.error(`Sync failed for source ${source.name}:`, err.message);
    }
  }
  return synced;
}

async function rebuildManifest() {
  try {
    const manifest = await buildManifest();
    console.log(`Manifest rebuilt (version ${manifest.version}).`);
  } catch (err) {
    console.error("Manifest build failed:", err.message);
  }
}

async function bootSync() {
  console.log("Starting boot sync...");
  await refreshSources();
  await rebuildManifest();
  console.log("Boot sync completed.");
}

async function scheduledSync() {
  console.log("Running scheduled sync...");
  const synced = await refreshSources();
  if (synced) await rebuildManifest();
}

module.exports = {
  bootSync,
  scheduledSync,
};