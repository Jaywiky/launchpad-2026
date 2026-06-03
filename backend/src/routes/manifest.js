const express = require("express")
const { param, validationResult } = require("express-validator")
const { getManifest, getBlob } = require("../services/manifestService")

const router = express.Router()

// GET /api/manifest -> signed envelope: { version, datasets, signature }
router.get("/manifest", async (req, res, next) => {
  try {
    const manifest = await getManifest()
    res.json(manifest)
  } catch (err) {
    next(err)
  }
})

// GET /api/blob/:hash -> the exact canonical bytes whose sha256 is :hash.
router.get(
  "/blob/:hash",
  [param("hash").matches(/^[a-f0-9]{64}$/).withMessage("hash must be a 64-char hex sha256")],
  async (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        error: { code: "INVALID_PARAMS", message: errors.array()[0].msg },
      })
    }
    try {
      const body = await getBlob(req.params.hash)
      if (body == null) {
        return res.status(404).json({
          status: "error",
          error: { code: "NOT_FOUND", message: "Unknown blob hash" },
        })
      }
      res.type("application/json").send(body)
    } catch (err) {
      next(err)
    }
  },
)

module.exports = router