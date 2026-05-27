require("dotenv").config();
const express = require("express");
const cors = require("cors");
const errorHandler = require("./src/middleware/errorHandler");
const { initCache } = require("./src/services/cache");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
      details: null,
    },
  });
});

// ── Error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
  initCache();
  app.listen(PORT, () => {
    console.log(`Launchpad API  →  http://localhost:${PORT}`);
    console.log(`Env: ${process.env.NODE_ENV || "development"}`);
  });
}
