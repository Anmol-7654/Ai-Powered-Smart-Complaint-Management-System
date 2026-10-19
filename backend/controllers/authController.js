const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { isDatabaseUnavailable } = require("../utils/databaseErrors");

const respondWithDatabaseUnavailable = (res) =>
  res.status(503).json({
    message: "Database is temporarily unavailable. Check the MongoDB Atlas connection and try again.",
  });

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
};

// @desc Register a new user
// @route POST /api/auth/register
exports.registerUser = async (req, res) => {
  try {
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide name, email and password" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const user = await User.create({ name, email, password, phone, role: "user" });
    const token = signToken(user._id);

    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (error) {
    if (isDatabaseUnavailable(error) || User.db.readyState !== 1) {
      console.error("Registration database request failed:", error.name, error.code || "");
      return respondWithDatabaseUnavailable(res);
    }
    console.error("Registration failed:", error.message);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

// @desc Login
// @route POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const body = req.body || {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password is required" });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user._id);
    res.json({ token, user: user.toSafeObject() });
  } catch (error) {
    if (isDatabaseUnavailable(error) || User.db.readyState !== 1) {
      console.error("Login database request failed:", error.name, error.code || "");
      return respondWithDatabaseUnavailable(res);
    }
    console.error("Login failed:", error.message);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
};

// @desc Get current logged in user
// @route GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ user: req.user.toSafeObject ? req.user.toSafeObject() : req.user });
};
