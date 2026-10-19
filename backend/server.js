

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const { isDatabaseUnavailable } = require("./utils/databaseErrors");

const authRoutes = require("./routes/authRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const userRoutes = require("./routes/userRoutes");
const aiRoutes = require("./routes/aiRoutes");
const chatRoutes = require("./routes/chatRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

if (process.env.TRUST_PROXY) {
  app.set(
    "trust proxy",
    process.env.TRUST_PROXY.split(",").map((address) => address.trim())
  );
}

app.use(cors({origin: process.env.CLIENT_URL || "*"}));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res)=> res.json({status: "ok"}));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);

//404 handler
app.use((req, res)=> res.status(404).json({message: "Route not found"}));

app.use(errorHandler);
const Port = process.env.PORT || 5000;

const startServer = async () => {
  while (true) {
    try {
      await connectDB();
      break;
    } catch (error) {
      if (!isDatabaseUnavailable(error)) {
        console.error("Server startup failed because MongoDB configuration is invalid.");
        process.exitCode = 1;
        return;
      }

      console.error("MongoDB is temporarily unreachable. Retrying connection in 10 seconds.");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  app.listen(Port, () => {
    console.log(`Server is running on port ${Port}`);
  });
};

startServer();