const { GoogleGenAI } = require("@google/genai");
const Complaint = require("../models/Complain");

const maxHistoryMessages = 10;
const maxMessageLength = 2000;
const maxAttemptsPerModel = 3;
const departmentByCategory = {
  Billing: "Billing/Finance",
  "Product Quality": "Quality Assurance",
  Service: "Customer Service",
  Delivery: "Logistics",
  Technical: "IT/Technical Support",
  "Staff behavior": "HR/Customer Relations",
  other: "General Support",
};

const getStatusCode = (error) =>
  Number(error.status || error.statusCode || error.code) || 0;

const isTransientError = (error) => {
  const status = getStatusCode(error);
  return status === 429 || status >= 500;
};

exports.sendMessage = async (req, res) => {
  const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
  const history = req.body.history === undefined ? [] : req.body.history;

  if (!message) {
    return res.status(400).json({ message: "message is required" });
  }

  if (message.length > maxMessageLength) {
    return res.status(400).json({
      message: `message must be at most ${maxMessageLength} characters`,
    });
  }

  if (!Array.isArray(history) || history.length > maxHistoryMessages) {
    return res.status(400).json({
      message: `history must be an array with at most ${maxHistoryMessages} messages`,
    });
  }

  const validHistory = history.every(
    (item) =>
      item &&
      (item.role === "user" || item.role === "model") &&
      typeof item.text === "string" &&
      item.text.trim().length > 0 &&
      item.text.length <= maxMessageLength
  );

  if (!validHistory) {
    return res.status(400).json({
      message: "each history item must have a user or model role and a valid text value",
    });
  }

  const complaintIdMatch = message.match(/\bCMP-\d{4}-\d{5,}\b/i);
  const asksForLatestComplaint =
    /\b(latest|last|recent|newest|nayi|naya|aakhri|akhiri)\b.{0,40}\b(complaint|ticket|shikayat|id|status)\b/i.test(message) ||
    /\b(complaint|ticket|shikayat|id|status)\b.{0,40}\b(latest|last|recent|newest|nayi|naya|aakhri|akhiri)\b/i.test(message);
  const asksForComplaintList =
    /\b(all|my|list|show|records|history|sabhi|saari|meri)\b.{0,40}\b(complaints?|tickets?|shikayat)\b/i.test(message) ||
    /\b(complaints?|tickets?|shikayat)\b.{0,40}\b(records|history|list|all|sabhi|saari)\b/i.test(message);
  const asksForComplaintStatus =
    /\b(status|track|tracking|where|progress|resolve|resolved|when|kaha|kahan|kab|stithi)\b/i.test(message) &&
    /\b(complaint|ticket|shikayat|status|id)\b/i.test(message);

  if (complaintIdMatch || asksForLatestComplaint || asksForComplaintList || asksForComplaintStatus) {
    try {
      const userFilter = req.user.role === "admin" ? {} : { submittedBy: req.user._id };
      const fields =
        "complaintId title category department priority status createdAt resolvedAt submittedBy";

      if (asksForComplaintList && !complaintIdMatch) {
        const complaints = await Complaint.find(userFilter)
          .sort({ createdAt: -1 })
          .limit(5)
          .select(fields);

        if (complaints.length === 0) {
          return res.json({
            reply: "No complaints were found for your account. Select New Ticket to submit one.",
            complaints: [],
          });
        }

        return res.json({
          reply: complaints
            .map(
              (complaint) =>
                `${complaint.complaintId} — ${complaint.title} | Status: ${complaint.status} | ` +
                `Department: ${complaint.department || departmentByCategory[complaint.category]}`
            )
            .join("\n"),
          complaints: complaints.map((complaint) => ({
            complaintId: complaint.complaintId,
            title: complaint.title,
            status: complaint.status,
            category: complaint.category,
            priority: complaint.priority,
            createdAt: complaint.createdAt,
            resolvedAt: complaint.resolvedAt,
          })),
        });
      }

      const filter = complaintIdMatch
        ? { complaintId: complaintIdMatch[0].toUpperCase() }
        : userFilter;
      let query = Complaint.findOne(filter);
      if (!complaintIdMatch) query = query.sort({ createdAt: -1 });
      const complaint = await query.select(fields);

      const isOwner =
        complaint &&
        complaint.submittedBy.toString() === req.user._id.toString();

      if (!complaint && !complaintIdMatch) {
        return res.json({
          reply: "No complaints were found for your account. Select New Ticket to submit one.",
          complaint: null,
        });
      }

      if (!complaint || (req.user.role !== "admin" && !isOwner)) {
        return res.status(404).json({
          message: "Complaint not found. Check the complaint ID and try again.",
        });
      }

      const resolutionText = complaint.resolvedAt
        ? `It was resolved on ${complaint.resolvedAt.toLocaleDateString()}.`
        : "A resolution date is not available yet. The system does not currently store estimated resolution times, so I can't promise a date.";

      return res.json({
        reply: [
          asksForLatestComplaint && !complaintIdMatch ? "Your latest complaint:" : null,
          asksForComplaintStatus && !asksForLatestComplaint && !complaintIdMatch
            ? "Your latest complaint status:"
            : null,
          `Complaint ${complaint.complaintId}: ${complaint.title}`,
          `Status: ${complaint.status}.`,
          `Category: ${complaint.category}; department: ${complaint.department || departmentByCategory[complaint.category]}; priority: ${complaint.priority}.`,
          `Submitted: ${complaint.createdAt.toLocaleDateString()}.`,
          resolutionText,
          "To view the full complaint, open Complaints in your dashboard.",
        ].filter(Boolean).join("\n"),
        complaint: {
          complaintId: complaint.complaintId,
          status: complaint.status,
          category: complaint.category,
          priority: complaint.priority,
          createdAt: complaint.createdAt,
          resolvedAt: complaint.resolvedAt,
        },
      });
    } catch (error) {
      console.error("Chat complaint status lookup failed:", error.message);
      return res.status(500).json({ message: "Could not check complaint status right now." });
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ message: "AI service is not configured" });
  }

  let lastModelAttempted;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const models = [
      ...new Set([
        process.env.GEMINI_MODEL || "gemini-3.8-flash",
        process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite",
      ]),
    ];
    const contents = [
      ...history.map(({ role, text }) => ({
        role,
        parts: [{ text: text.trim() }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];
    let reply;

    for (const [modelIndex, model] of models.entries()) {
      for (let attempt = 0; attempt < maxAttemptsPerModel; attempt += 1) {
        try {
          lastModelAttempted = model;
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction:
                "You are a helpful support assistant for a complaint management system. " +
                "Answer questions about filing, tracking, and resolving complaints clearly and politely. " +
                "A complaint is submitted from the New Ticket page; tell users to enter a title and description, " +
                "choose a category and priority, then submit. Explain that the complaint ID is shown after submission " +
                "and can be used to check status in this chat. For categorization guidance, map Billing to Billing/Finance, " +
                "Product Quality to Quality Assurance, Service to Customer Service, Delivery to Logistics, " +
                "Technical to IT/Technical Support, Staff behavior to HR/Customer Relations, and other to General Support. " +
                "When a complaint record is supplied, use its saved department as the assigned department. " +
                "Never promise a resolution date or invent a service-level agreement; explain that no estimated resolution " +
                "time is currently recorded, and provide a date only if explicitly present in the supplied conversation. " +
                "Do not claim to access account or complaint records unless that information is provided in the conversation.",
              temperature: 0.4,
              maxOutputTokens: 1024,
            },
          });
          reply = response.text?.trim();
          if (!reply) {
            throw new Error("Gemini returned an empty chat response");
          }
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
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      if (reply) break;
    }

    if (!reply) {
      throw new Error("Gemini did not return a chat response");
    }

    return res.json({ reply });
  } catch (error) {
    const status = getStatusCode(error);
    console.error("Gemini chat failed:", {
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

    return res.status(502).json({ message: "AI chat failed. Please try again later." });
  }
};
