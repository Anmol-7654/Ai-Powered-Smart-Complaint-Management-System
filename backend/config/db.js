const dns = require("node:dns");

const dnsServers = (
  process.env.MONGODB_DNS_SERVERS || "1.1.1.1,8.8.8.8"
)
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);

dns.setServers(dnsServers);

const mongoose = require("mongoose");

const connectDB = async () => {
  const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!rawUri) {
    console.error("MongoDB connection error: MONGODB_URI is missing in backend/.env");
    process.exit(1);
  }

  const uri = rawUri.trim();

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      retryWrites: true,
      maxPoolSize: 10,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    if (error.reason?.servers instanceof Map) {
      for (const [address, server] of error.reason.servers) {
        if (server.error) {
          console.error(
            `MongoDB node ${address} failed: ${server.error.name || "Error"} - ` +
              (server.error.message || "No error details").split("\n")[0]
          );
        }
      }
    }
    console.error("Check the Atlas URI, database user credentials, and Network Access IP allowlist.");
    throw error;
  }
};

module.exports = connectDB;