const crypto = require("crypto");
const pool = require("../../database/db");

const TYPES = ["food_bank", "toilet", "library", "recycling", "green_space"];

function getSigningKey() {
  const b64 = process.env.MANIFEST_SIGNING_KEY;
  if (!b64) throw new Error("MANIFEST_SIGNING_KEY is not set");
  const pem = Buffer.from(b64, "base64").toString("utf8");
  return crypto.createPrivateKey(pem);
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  if (value && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value ?? null);
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function formatResource(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lng),
    address: row.address,
    opening_hours: row.opening_hours || null,
    notes: row.notes || null,
    source: row.source,
    lang: row.lang,
    extended: row.extended ?? {},
  };
}

function stableExtended(extended) {
  const out = {};
  for (const key of Object.keys(extended).sort()) {
    const v = extended[key];
    out[key] = Array.isArray(v) ? [...v].sort() : v;
  }
  return out;
}

async function buildBlob(client, type, lang) {
  const { rows } = await client.query(
    `SELECT * FROM launchpad.resources WHERE type = $1 AND lang = $2 ORDER BY id ASC`,
    [type, lang],
  );
  const resources = rows
    .map(formatResource)
    .map((r) => ({ ...r, extended: stableExtended(r.extended) }));
  const body = canonicalJson(resources);
  return { hash: sha256Hex(Buffer.from(body, "utf8")), body };
}

async function distinctLangs(client, type) {
  const { rows } = await client.query(
    `SELECT DISTINCT lang FROM launchpad.resources WHERE type = $1`,
    [type],
  );
  return rows.map((r) => r.lang).filter(Boolean);
}

function collectHashSet(manifest) {
  const hashes = [];
  for (const ds of manifest?.datasets ?? []) {
    if (ds.data) hashes.push(ds.data);
    for (const h of Object.values(ds.translations ?? {})) if (h) hashes.push(h);
  }
  return hashes;
}

// Rebuild the manifest from current DB contents. Call this whenever the data changes
// (i.e. after a sync). Version advances only when the set of content hashes changes.
async function buildManifest() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const datasets = [];
    const blobs = []; // { hash, body }

    for (const type of TYPES) {
      const langs = await distinctLangs(client, type);
      if (langs.length === 0) continue; // no data for this type yet

      const dataLang = langs.includes("en") ? "en" : langs[0];
      const dataBlob = await buildBlob(client, type, dataLang);
      blobs.push(dataBlob);

      const translations = {};
      for (const lang of langs) {
        if (lang === dataLang) continue;
        const t = await buildBlob(client, type, lang);
        blobs.push(t);
        translations[lang] = t.hash;
      }

      datasets.push({ data: dataBlob.hash, translations });
    }

    // Deterministic dataset order so the signed bytes are reproducible.
    datasets.sort((a, b) => a.data.localeCompare(b.data));

    const newHashSet = blobs
      .map((b) => b.hash)
      .sort()
      .join(",");

    const prev = await client.query(
      `SELECT version, manifest FROM launchpad.manifest_state WHERE id = 1`,
    );
    const prevRow = prev.rows[0];
    const prevHashSet = prevRow ? collectHashSet(prevRow.manifest).sort().join(",") : null;

    const version =
      prevRow && prevHashSet === newHashSet
        ? prevRow.version
        : prevRow
          ? prevRow.version + 1
          : 1;

    // Sign the canonical bytes of everything EXCEPT the signature field.
    const unsigned = { version, datasets };
    const signature = crypto
      .sign(null, Buffer.from(canonicalJson(unsigned), "utf8"), getSigningKey())
      .toString("base64");

    const manifest = { ...unsigned, signature };

    console.log(canonicalJson(unsigned))

    await client.query(
      `INSERT INTO launchpad.manifest_state (id, version, manifest, built_at)
       VALUES (1, $1, $2, NOW())
       ON CONFLICT (id) DO UPDATE
         SET version = EXCLUDED.version, manifest = EXCLUDED.manifest, built_at = NOW()`,
      [version, manifest],
    );

    for (const { hash, body } of blobs) {
      await client.query(
        `INSERT INTO launchpad.manifest_blobs (hash, body, built_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (hash) DO NOTHING`,
        [hash, body],
      );
    }

    // GC blobs no longer referenced by the current manifest.
    const keep = blobs.map((b) => b.hash);
    await client.query(
      `DELETE FROM launchpad.manifest_blobs WHERE hash <> ALL($1::text[])`,
      [keep.length ? keep : [""]],
    );

    await client.query("COMMIT");
    return manifest;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getManifest() {
  const { rows } = await pool.query(
    `SELECT manifest FROM launchpad.manifest_state WHERE id = 1`,
  );
  return rows[0] ? rows[0].manifest : buildManifest();
}

async function getBlob(hash) {
  const { rows } = await pool.query(
    `SELECT body FROM launchpad.manifest_blobs WHERE hash = $1`,
    [hash],
  );
  return rows[0] ? rows[0].body : null;
}

module.exports = { buildManifest, getManifest, getBlob };