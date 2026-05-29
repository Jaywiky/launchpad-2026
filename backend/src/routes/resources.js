const express = require("express");
const { query, param, validationResult } = require("express-validator");
const {
  getResources,
  getResourceById,
} = require("../services/resourceService");

const router = express.Router();

// Validation rules for GET api/resources
const listValidation = [
  query("type")
    .optional()
    .isIn(["food_bank", "toilet", "library", "recycling", "green_space"])
    .withMessage(
      "type must be one of: food_bank, toilet, library, recycling, green_space",
    ),
  query("lang")
    .optional()
    .isLocale()
    .withMessage("lang must be a valid language tag"),
];

// Validation rules for GET /api/resources/:id
const idValidation = [
  param("id")
    .matches(/^(givefood|overpass)_.+$/)
    .withMessage("id must match pattern {source}_{externalId}"),
];

// validation handler
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    res.status(400).json({
      status: "error",
      error: {
        code: "INVALID_PARAMS",
        message: first.msg,
        details: errors.array(),
      },
    });
    return true;
  }
  return false;
}

router.get("/resources", listValidation, async (req, res, next) => {
  if (handleValidation(req, res)) return;

  try {
    const type = req.query.type || null;
    const lang = req.query.lang || "en";

    const data = await getResources({ type, lang });
    res.json({
      status: "ok",
      meta: {
        count: data.length,
        type,
        lang,
      },
      data,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/resources/:id", idValidation, async (req, res, next) => {
  if (handleValidation(req, res)) return;

  try {
    const resource = await getResourceById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        status: "error",
        error: {
          code: "NOT_FOUND",
          message: `Resource ${req.params.id} not found`,
        },
      });
    }

    res.json({ status: "ok", data: resource });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
