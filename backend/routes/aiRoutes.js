const express = require("express");
const { protect, adminOnly } = require("../middleware/auth");
const { analyzeComplaint, getInsights } = require("../controllers/aiController");

const router = express.Router();

router.post("/analyze", protect, analyzeComplaint);
router.get("/insights", protect, adminOnly, getInsights);

module.exports = router;
