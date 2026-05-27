/**
 * Express global error handler.
 * Catches anything passed via next(err).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  console.error("[errorHandler]", err);

  // Axios errors (upstream API failures)
  if (err.isAxiosError) {
    return res.status(502).json({
      status: "error",
      error: {
        code: "UPSTREAM_ERROR",
        message: `Upstream API request failed: ${err.message}`,
        details: null,
      },
    });
  }

  res.status(err.status || 500).json({
    status: "error",
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "An unexpected error occurred",
      details: null,
    },
  });
}

module.exports = errorHandler;
