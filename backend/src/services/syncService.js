const pool = require("../../database/db");
const givefood = require("../apis/givefood");
const overpass = require("../apis/overpass");
const { buildManifest } = require("./manifestService");
const { extractTranslations } = require("../utils/translationExtractor");
const { translate } = require("@vitalets/google-translate-api");
const { sanitizeResources } = require("../utils/sanitize");

const SOURCES = [
  { name: "givefood", ttl: 24 * 60 * 60 * 1000 },
  { name: "overpass", ttl: 24 * 60 * 60 * 1000 },
];

const LIBRETRANSLATE_URL =
  process.env.LIBRETRANSLATE_URL || "http://localhost:5000";
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || "";
const TARGET_LANGS = ["pl", "ur"];

async function translateBatch(texts, targetLang) {
  if (texts.length === 0) return [];

  const body = { q: texts, source: "en", target: targetLang, format: "text" };
  if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;

  const res = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`LibreTranslate ${targetLang} responded ${res.status}`)
 
  const data = await res.json()
  return Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText]
}
 
async function upsertTranslations(client, store) {
  const hashes = Object.keys(store)
  if (hashes.length === 0) return
 
  const haveAll = TARGET_LANGS.map((l) => `translations ? '${l}'`).join(" AND ")
  const { rows } = await client.query(
    `SELECT hash FROM launchpad.data_translations
     WHERE hash = ANY($1::text[]) AND ${haveAll}`,
    [hashes]
  )
  const completeHashes = new Set(rows.map((r) => r.hash))
  const newHashes = hashes.filter((h) => !completeHashes.has(h))
 
  console.log(`Translations: ${hashes.length} strings, ${newHashes.length} need translating.`)
  const translated = {}
  for (const h of newHashes) translated[h] = { en: store[h].en }
 
  if (newHashes.length > 0) {
    const newTexts = newHashes.map((h) => store[h].en)
 
    const results = await Promise.allSettled(
      TARGET_LANGS.map(async (lang) => ({ lang, out: await translateBatch(newTexts, lang) }))
    )
 
    for (const r of results) {
      if (r.status === "fulfilled") {
        newHashes.forEach((h, i) => {
          if (r.value.out[i]) translated[h][r.value.lang] = r.value.out[i]
        })
      } else {
        console.error("Translation batch failed:", r.reason?.message || r.reason)
      }
    }
  }
 
  for (const hash of hashes) {
    const typesArray = Array.from(store[hash].types)
    const translationsJson = translated[hash] ?? { en: store[hash].en }
 
    await client.query(
      `INSERT INTO launchpad.data_translations (hash, translations, used_in_types)
       VALUES ($1, $2::jsonb, $3::text[])
       ON CONFLICT (hash) DO UPDATE SET
         used_in_types = ARRAY(
           SELECT DISTINCT UNNEST(launchpad.data_translations.used_in_types || EXCLUDED.used_in_types)
         )`,
      [hash, JSON.stringify(translationsJson), typesArray]
    )
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

  return sanitizeResources(
    enriched.map((r, i) => {
      if (r.status === "fulfilled" && r.value) return r.value;
      console.warn(`GiveFood: Failed to enrich item ${list[i].id}`);
      return list[i]; // Return original item if enrichment fails
    }),
  );
}

// Fetch from Overpass API
async function fetchOverpass() {
  const list = await overpass.fetch();
  console.log(`Overpass: Fetched ${list.length} resources.`);
  return sanitizeResources(list);
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