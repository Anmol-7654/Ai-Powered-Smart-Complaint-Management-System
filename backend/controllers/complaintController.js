const Complaint = require("../models/Complain");
const User = require("../models/User");
const mongoose = require("mongoose");
const { createNotifications } = require("../utils/notifications");
const {
  analyzeComplaint,
  departmentByCategory,
} = require("../services/complaintAnalysis");
const { sendComplaintStatusEmail } = require("../services/emailService");

const validStatuses = ["Open", "In Progress", "Resolved", "Closed", "Rejected"];
const validDepartments = Object.values(departmentByCategory);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const complaintForResponse = (complaint, user) => {
  const result = complaint.toObject();
  if (user.role !== "admin") {
    delete result.ipAddress;
  }
  return result;
};

const generateComplaintId = async () => {
  const year = new Date().getFullYear();
  const count = await Complaint.countDocuments();
  const seq = String(count + 1).padStart(5, "0");
  const complaintNumber = `CMP-${year}-${seq}`;

  const exists = await Complaint.findOne({ complaintId: complaintNumber });
  if (exists) {
    return `CMP-${year}-${Date.now().toString().slice(-6)}`;
  }

  return complaintNumber;
};

// @desc Create a complaint
// @route POST /api/complaints
exports.createComplaint = async (req, res) => {
  try {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const description =
      typeof req.body.description === "string" ? req.body.description.trim() : "";
    const attachmentUrl =
      typeof req.body.attachmentUrl === "string" ? req.body.attachmentUrl.trim() : "";

    if (!title || !description) {
      return res.status(400).json({ message: "title and description are required" });
    }
    if (title.length > 200 || description.length > 4000) {
      return res.status(400).json({
        message: "title must be at most 200 characters and description at most 4000 characters",
      });
    }

    const analysis = await analyzeComplaint(title, description);

    const complaintId = await generateComplaintId();
    const complaint = await Complaint.create({
      complaintId,
      title,
      description,
      category: analysis.category,
      department: analysis.department,
      priority: analysis.priority,
      summary: analysis.summary,
      attachmentUrl,
      ipAddress: req.ip || "",
      submittedBy: req.user._id,
      history: [{ status: "Open", note: "Complaint submitted", changedBy: req.user.name }],
    });

    let notificationWarning;
    try {
      const adminIds = await User.find({ role: "admin" }).distinct("_id");
      await createNotifications(adminIds, {
        complaint: complaint._id,
        type: "complaint-created",
        title: "New complaint submitted",
        message: `${req.user.name} submitted ${complaint.complaintId}.`,
      });
    } catch (error) {
      console.error("New complaint notification failed:", error.message);
      notificationWarning = "Complaint was saved, but administrator notifications could not be delivered.";
    }

    res.status(201).json({ complaint: complaintForResponse(complaint, req.user), notificationWarning });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Failed to create complaint:", error.message);
    res.status(500).json({ message: "Failed to create complaint", error: error.message });
  }
};

// @desc Get complaints
// @route GET /api/complaints
exports.getComplaints = async (req, res) => {
  try {
    const { status, category, priority, search } = req.query;
    const filter = {};

    if (req.user.role !== "admin") {
      filter.submittedBy = req.user._id;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    if (search) {
      const safeSearch = escapeRegex(String(search).slice(0, 100));
      const searchPattern = { $regex: safeSearch, $options: "i" };
      filter.$or = [
        { title: searchPattern },
        { complaintId: searchPattern },
        { description: searchPattern },
      ];

      if (req.user.role === "admin") {
        const matchingUsers = await User.find({
          role: "user",
          $or: [{ name: searchPattern }, { email: searchPattern }],
        }).distinct("_id");
        filter.$or.push({ submittedBy: { $in: matchingUsers } });
      }
    }

    const complaints = await Complaint.find(filter)
      .populate("submittedBy", "name email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.json({ complaints: complaints.map((complaint) => complaintForResponse(complaint, req.user)) });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch complaints", error: error.message });
  }
};

// @desc Get single complaint
// @route GET /api/complaints/:id
exports.getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate("submittedBy", "name email")
      .populate("assignedTo", "name email");

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const isOwner = complaint.submittedBy && complaint.submittedBy._id.toString() === req.user._id.toString();
    if (req.user.role !== "admin" && !isOwner) {
      return res.status(403).json({ message: "You do not have access to this complaint" });
    }

    res.json({ complaint: complaintForResponse(complaint, req.user) });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch complaint", error: error.message });
  }
};

// @desc Update complaint status / assignment (admin only)
// @route PATCH /api/complaints/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { status, note, assignedTo, department } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid complaint status" });
    }
    if (department !== undefined && !validDepartments.includes(department)) {
      return res.status(400).json({ message: "Invalid complaint department" });
    }
    if (note !== undefined && (typeof note !== "string" || note.length > 1000)) {
      return res.status(400).json({ message: "Status note must be text of at most 1000 characters" });
    }

    const statusChanged = status && status !== complaint.status;
    if (statusChanged) {
      complaint.status = status;
      complaint.history.push({ status, note: note || "", changedBy: req.user.name });
      if (status === "Resolved" || status === "Closed") {
        complaint.resolvedAt = new Date();
      } else {
        complaint.resolvedAt = null;
      }
    }

    if (assignedTo !== undefined) {
      if (assignedTo) {
        if (!mongoose.isValidObjectId(assignedTo)) {
          return res.status(400).json({ message: "Invalid admin assignee" });
        }
        const admin = await User.findOne({ _id: assignedTo, role: "admin" });
        if (!admin) return res.status(404).json({ message: "Admin assignee not found" });
      }
      complaint.assignedTo = assignedTo || null;
    }

    if (department !== undefined) {
      complaint.department = department;
    }

    await complaint.save();
    let notificationWarning;
    let emailWarning;
    if (statusChanged) {
      try {
        const detail = typeof note === "string" ? note.trim() : "";
        await createNotifications([complaint.submittedBy], {
          complaint: complaint._id,
          type: "status-updated",
          title: "Complaint status updated",
          message: `${complaint.complaintId} is now ${complaint.status}${detail ? `: ${detail}` : "."}`,
        });
      } catch (error) {
        console.error("Complaint status notification failed:", error.message);
        notificationWarning = "Status was saved, but the notification could not be delivered.";
      }

      try {
        const recipient = await User.findById(complaint.submittedBy).select("name email");
        if (!recipient?.email) {
          throw new Error("Complaint owner does not have an email address");
        }

        const delivery = await sendComplaintStatusEmail({
          recipient,
          complaint,
          status: complaint.status,
          note: typeof note === "string" ? note.trim() : "",
        });
        if (!delivery.sent) emailWarning = delivery.warning;
      } catch (error) {
        console.error("Complaint status email failed:", error.message);
        emailWarning = "Status was saved, but the email notification could not be sent.";
      }
    }
    res.json({ complaint, notificationWarning, emailWarning });
  } catch (error) {
    res.status(500).json({ message: "Failed to update complaint", error: error.message });
  }
};

// @desc Add a comment to a complaint
// @route POST /api/complaints/:id/comments
exports.addComment = async (req, res) => {
  try {
    const { message } = req.body;

    if (typeof message !== "string" || !message.trim() || message.length > 2000) {
      return res.status(400).json({ message: "Comment message must be text of at most 2000 characters" });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const isOwner = complaint.submittedBy.toString() === req.user._id.toString();
    if (req.user.role !== "admin" && !isOwner) {
      return res.status(403).json({ message: "You do not have access to this complaint" });
    }

    complaint.comments.push({
      author: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      message: message.trim(),
    });

    await complaint.save();
    let notificationWarning;
    try {
      const recipients =
        req.user.role === "admin"
          ? [complaint.submittedBy]
          : await User.find({ role: "admin" }).distinct("_id");
      await createNotifications(recipients, {
        complaint: complaint._id,
        type: "comment-added",
        title: "New complaint comment",
        message: `${req.user.name} commented on ${complaint.complaintId}.`,
      });
    } catch (error) {
      console.error("Complaint comment notification failed:", error.message);
      notificationWarning = "Comment was saved, but the notification could not be delivered.";
    }
    res.status(201).json({ complaint: complaintForResponse(complaint, req.user), notificationWarning });
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment", error: error.message });
  }
};

// @desc Delete a complaint
// @route DELETE /api/complaints/:id
exports.deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const isOwner = complaint.submittedBy.toString() === req.user._id.toString();
    if (req.user.role !== "admin" && !(isOwner && complaint.status === "Open")) {
      return res.status(403).json({ message: "This complaint can no longer be deleted" });
    }

    await complaint.deleteOne();
    res.json({ message: "Complaint deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete complaint", error: error.message });
  }
};

// @desc Dashboard stats
// @route GET /api/complaints/stats/summary
exports.getStats = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { submittedBy: req.user._id };

    const [total, open, inProgress, resolved, closed, rejected] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.countDocuments({ ...filter, status: "Open" }),
      Complaint.countDocuments({ ...filter, status: "In Progress" }),
      Complaint.countDocuments({ ...filter, status: "Resolved" }),
      Complaint.countDocuments({ ...filter, status: "Closed" }),
      Complaint.countDocuments({ ...filter, status: "Rejected" }),
    ]);

    const [byCategory, byDepartment, byMonth] = await Promise.all([
      Complaint.aggregate([
      { $match: filter },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      ]),
      Complaint.aggregate([
        { $match: filter },
        { $group: { _id: { $ifNull: ["$department", "General Support"] }, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      Complaint.aggregate([
        {
          $match: {
            ...filter,
            createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ total, open, inProgress, resolved, closed, rejected, byCategory, byDepartment, byMonth });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stats", error: error.message });
  }
};