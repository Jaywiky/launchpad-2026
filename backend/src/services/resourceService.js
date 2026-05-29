const pool = require("../../database/db");

// Fetch resources from DB
async function getResources({ type, lang }) {
  const query = type
    ? `SELECT * FROM launchpad.resources WHERE type = $1`
    : `SELECT * FROM launchpad.resources`;

  const params = type ? [type] : [];
  const { rows } = await pool.query(query, params);

  return rows.map(formatResource);
}

// Fetch resource by ID
async function getResourceById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM launchpad.resources WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return null;
  return formatResource(rows[0]);
}

// Format a DB row to match the schema
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

module.exports = { getResources, getResourceById };
