const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
    {
        author:{
            type: mongoose.Schema.Types.ObjectId, ref: "User", required: true
        },
        authorName: {
            type: String,
            required: true
        },
        authorRole: {
            type: String,
            enum :["user","admin"], required: true
        },
        message:{
            type: String,
            required: true
        },
    },
    {timestamps: true}
);
const historySchema = new mongoose.Schema(
    {
        status: {type: String, required: true},
        note: { type: String, default: ""},
        changedBy:{type: String, default: "system"},
        changedAt: {type: Date, default: Date.now},
    },
    {_id: false}
);

const complaintSchema = new mongoose.Schema(
    {
        complaintId: { type: String, required: true, unique: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true },
        summary: { type: String, trim: true, default: "" },
        category: {
            type: String,
            required: true,
            enum: ["Billing", "Product Quality", "Service", "Delivery", "Technical", "Staff behavior", "other"],
        },
        department: {
            type: String,
            enum: ["Billing/Finance", "Quality Assurance", "Customer Service", "Logistics", "IT/Technical Support", "HR/Customer Relations", "General Support"],
            default: "General Support",
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Urgent"],
            default: "Medium",
        },
        status: {
            type: String,
            enum: ["Open", "In Progress", "Resolved", "Closed", "Rejected"],
            default: "Open",
        },
        submittedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        attachmentUrl: { type: String, default: "" },
        ipAddress: { type: String, default: "" },
        comments: [commentSchema],
        history: [historySchema],
        resolvedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

complaintSchema.index({ submittedBy: 1, status: 1 });

module.exports = mongoose.model("Complaint", complaintSchema);
