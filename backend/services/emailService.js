const nodemailer = require("nodemailer");

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const getSmtpSettings = () => ({
  host: process.env.SMTP_HOST?.trim(),
  user: process.env.SMTP_USER?.trim(),
  password: process.env.SMTP_PASS?.trim(),
  from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim(),
});

const createTransporter = () => {
  const { host, user, password, from } = getSmtpSettings();

  if (!host || !user || !password || !from) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid port number");
  }

  const secureSetting = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (secureSetting && secureSetting !== "true" && secureSetting !== "false") {
    throw new Error("SMTP_SECURE must be true or false");
  }
  const secure = secureSetting ? secureSetting === "true" : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
  });
};

exports.sendComplaintStatusEmail = async ({ recipient, complaint, status, note }) => {
  const transporter = createTransporter();
  if (!transporter) {
    const settings = getSmtpSettings();
    const missingSettings = [
      ["SMTP_HOST", settings.host],
      ["SMTP_USER", settings.user],
      ["SMTP_PASS", settings.password],
      ["SMTP_FROM (or SMTP_USER)", settings.from],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    return {
      sent: false,
      warning: `Email was not sent: ${missingSettings.join(", ")} ${missingSettings.length === 1 ? "is" : "are"} missing or blank in backend/.env. Restart the backend after editing the file.`,
    };
  }

  const safeName = escapeHtml(recipient.name || "Customer");
  const safeComplaintId = escapeHtml(complaint.complaintId);
  const safeTitle = escapeHtml(complaint.title);
  const safeStatus = escapeHtml(status);
  const safeNote = note ? escapeHtml(note) : "";
  const complaintUrl = process.env.CLIENT_URL
    ? `${process.env.CLIENT_URL.replace(/\/+$/, "")}/complaints/${complaint._id}`
    : "";
  const safeComplaintUrl = complaintUrl ? escapeHtml(complaintUrl) : "";
  const text = [
    `Hello ${recipient.name || "Customer"},`,
    "",
    `The status of your complaint ${complaint.complaintId} has changed to ${status}.`,
    `Complaint: ${complaint.title}`,
    note ? `Update: ${note}` : "",
    complaintUrl ? `View complaint: ${complaintUrl}` : "",
    "",
    "Resolve Complaint Management",
  ].filter(Boolean).join("\n");

  await transporter.sendMail({
    from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER.trim(),
    to: recipient.email,
    subject: `Complaint ${complaint.complaintId} status: ${status}`,
    text,
    html: [
      `<p>Hello ${safeName},</p>`,
      `<p>The status of your complaint <strong>${safeComplaintId}</strong> has changed to <strong>${safeStatus}</strong>.</p>`,
      `<p><strong>Complaint:</strong> ${safeTitle}</p>`,
      safeNote ? `<p><strong>Update:</strong> ${safeNote}</p>` : "",
      safeComplaintUrl ? `<p><a href="${safeComplaintUrl}">View your complaint</a></p>` : "",
      "<p>Resolve Complaint Management</p>",
    ].filter(Boolean).join("\n"),
  });

  return { sent: true };
};
