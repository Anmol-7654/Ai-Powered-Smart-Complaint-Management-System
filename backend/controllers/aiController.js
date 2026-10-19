const { GoogleGenAI } = require("@google/genai");
const Complaint = require("../models/Complain");
const {
  analyzeComplaint: runComplaintAnalysis,
  getModels,
  getStatusCode,
  isTransientError,
  maxAttemptsPerModel,
  waitBeforeRetry,
} = require("../services/complaintAnalysis");

exports.analyzeComplaint = async (req, res) => {
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const description =
    typeof req.body.description === "string" ? req.body.description.trim() : "";

  if (!title || !description) {
    return res.status(400).json({ message: "title and description are required" });
  }

  if (title.length > 200 || description.length > 4000) {
    return res.status(400).json({
      message: "title must be at most 200 characters and description at most 4000 characters",
    });
  }

  try {
    const analysis = await runComplaintAnalysis(title, description);
    return res.json({ analysis });
  } catch (error) {
    return res.status(error.status || 502).json({ message: error.message });
  }
};

exports.getInsights = async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ message: "AI service is not configured" });
  }

  let lastModelAttempted;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);
    const [
      total,
      byStatus,
      byCategory,
      byDepartment,
      aging,
      recentPeriod,
      previousPeriod,
    ] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Complaint.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
      Complaint.aggregate([
        {
          $group: {
            _id: { $ifNull: ["$department", "General Support"] },
            count: { $sum: 1 },
          },
        },
      ]),
      Complaint.countDocuments({
        status: { $in: ["Open", "In Progress"] },
        createdAt: { $lte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      }),
      Complaint.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Complaint.countDocuments({
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      }),
    ]);

    const snapshot = {
      total,
      byStatus: Object.fromEntries(byStatus.map(({ _id, count }) => [_id, count])),
      byCategory: Object.fromEntries(byCategory.map(({ _id, count }) => [_id, count])),
      byDepartment: Object.fromEntries(byDepartment.map(({ _id, count }) => [_id, count])),
      openComplaintsOlderThan7Days: aging,
      createdInLast30Days: recentPeriod,
      createdInPrevious30Days: previousPeriod,
    };
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const models = getModels();
    let insights;

    for (const [modelIndex, model] of models.entries()) {
      for (let attempt = 0; attempt < maxAttemptsPerModel; attempt += 1) {
        try {
          lastModelAttempted = model;
          const response = await ai.models.generateContent({
            model,
            contents:
              "Review these aggregated complaint-management metrics and provide 3 to 5 short, " +
              "actionable administrator insights. Mention notable workload/status/category patterns " +
              "and any aged open backlog. Do not invent causes, promises, or facts not present in the metrics. " +
              "Return plain text as a numbered list.\n" +
              JSON.stringify(snapshot),
            config: { temperature: 0.2, maxOutputTokens: 700 },
          });
          insights = response.text?.trim();
          if (!insights) throw new Error("Gemini returned empty insights");
          break;
        } catch (error) {
          const status = getStatusCode(error);
          const hasFallback = modelIndex < models.length - 1;
          if (status === 404 && hasFallback) break;
          if (!isTransientError(error)) throw error;
          if (attempt === maxAttemptsPerModel - 1) {
            if (hasFallback) break;
            throw error;
          }
          await waitBeforeRetry(attempt);
        }
      }
      if (insights) break;
    }

    if (!insights) throw new Error("Gemini did not return insights");
    return res.json({ insights, snapshot, generatedAt: new Date().toISOString() });
  } catch (error) {
    const status = getStatusCode(error);
    console.error("Admin complaint insights failed:", {
      name: error.name || "Unknown error",
      status: status || "unknown",
      model: lastModelAttempted || "unknown",
      message: error.message || "No error message provided",
    });
    if (status === 429 || status >= 500) {
      return res.status(503).json({
        message: "AI service is temporarily unavailable. Please try again shortly.",
      });
    }
    return res.status(502).json({ message: "Could not generate AI insights." });
  }
};
