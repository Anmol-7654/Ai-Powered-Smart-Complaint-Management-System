const Notification = require("../models/Notification");

exports.createNotifications = async (recipients, notification) => {
  const uniqueRecipients = [...new Set(recipients.map((recipient) => recipient.toString()))];
  if (uniqueRecipients.length === 0) return;

  await Notification.insertMany(
    uniqueRecipients.map((recipient) => ({
      ...notification,
      recipient,
    }))
  );
};
