const express = require("express");
const { protect } = require("../middleware/auth");
const { sendMessage } = require("../controllers/chatController");

const router = express.Router();

router.post("/", protect, sendMessage);

module.exports = router;
