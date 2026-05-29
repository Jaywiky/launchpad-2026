require("dotenv").config();
const express = require("express");
const cors = require("cors");
const errorHandler = require("./src/middleware/errorHandler");
const resourceRoutes = require("./src/routes/resources");
const { bootSync, scheduledSync } = require("./src/services/syncService");

const app = express();
const PORT = process.env.PORT || 3001;

const SYNC_INTERVAL = 24 * 60 * 60 * 1000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api", resourceRoutes);

// 404
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

// Error handler
app.use(errorHandler);

// Boot

app.listen(PORT, async () => {
  console.log(`Launchpad API -> http://localhost:${PORT}`);
  console.log(`Env: ${process.env.NODE_ENV || "development"}`);

  // Run boot sync
  await bootSync();

  // Schedule recurring sync daily
  setInterval(async () => {
    await scheduledSync();
  }, SYNC_INTERVAL);
});

module.exports = app;
