const express = require("express");
const router = express.Router();
const {protect, adminOnly} = require("../middleware/auth");
const User = require("../models/User");

//@desc get all Admin users (for assignment dropdown)
//@route GET /api/users/admins
router.get("/admins", protect, adminOnly, async (req, res) => {
    try {
        const admins = await User.find({role: "admin"}).select("name email");
        res.json(admins);
    }catch (error) {
        res.status(500).json({message: "failed to fetch admin users", error: error.message});
    }
});

module.exports = router;