const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON request body. Send valid JSON." });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body exceeds the 2 MB limit." });
  }

  console.error("Unhandled request error:", error.stack || error.message);
  return res.status(500).json({ message: "Something went wrong on the server" });
};

module.exports = errorHandler;
