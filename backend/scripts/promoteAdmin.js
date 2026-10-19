const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const User = require("../models/User");
const connectDB = require("../config/db");

const email = process.argv[2]?.trim().toLowerCase();

const run = async () => {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: npm run promote-admin -- user@example.com");
    process.exitCode = 1;
    return;
  }

  try {
    await connectDB();
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { role: "admin" } },
      { returnDocument: "after" }
    );

    if (!user) {
      console.error("No account was found for that email. Register the account, then retry.");
      process.exitCode = 1;
      return;
    }

    console.log(`Administrator access granted to ${user.email}.`);
  } catch (error) {
    console.error("Could not promote administrator:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

run();
