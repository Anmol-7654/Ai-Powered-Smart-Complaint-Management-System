const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
    createComplaint,
    getComplaints,
    getComplaintById,
    updateStatus,
    addComment,
    deleteComplaint,
    getStats,
} = require("../controllers/complaintController");

router.use(protect);

router.route("/").get(getComplaints).post(createComplaint);
router.get("/stats/summary", getStats);
router.route("/:id").get(getComplaintById).delete(deleteComplaint);
router.patch("/:id/status",adminOnly, updateStatus);
router.post("/:id/comments",addComment);

module.exports = router;