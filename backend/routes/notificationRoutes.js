const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Notification = require("../models/Notification");

router.use(protect);

router.get("/", async (req, res) => {
  try {
    const filter = { recipient: req.user._id };
    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("complaint", "complaintId"),
      Notification.countDocuments({ ...filter, readAt: null }),
    ]);

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Failed to load notifications:", error.message);
    res.status(500).json({ message: "Failed to load notifications" });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Failed to mark notifications as read:", error.message);
    res.status(500).json({ message: "Failed to update notifications" });
  }
});

router.patch("/:id/read", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ notification });
  } catch (error) {
    console.error("Failed to mark notification as read:", error.message);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

module.exports = router;
