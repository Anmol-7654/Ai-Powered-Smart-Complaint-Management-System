const databaseNetworkErrorNames = new Set([
  "MongooseServerSelectionError",
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoServerSelectionError",
  "MongoTimeoutError",
  "MongoTopologyClosedError",
]);

const isDatabaseUnavailable = (error) => {
  const pendingErrors = [error];
  const visited = new Set();

  while (pendingErrors.length > 0) {
    const currentError = pendingErrors.pop();
    if (!currentError || visited.has(currentError)) continue;
    visited.add(currentError);
    const code = typeof currentError.code === "string" ? currentError.code : "";

    if (
      databaseNetworkErrorNames.has(currentError.name) ||
      /^(ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ERR_SSL|ERR_TLS|CERT_)/.test(code)
    ) {
      return true;
    }

    if (currentError.cause) pendingErrors.push(currentError.cause);
    if (currentError.reason?.servers instanceof Map) {
      for (const server of currentError.reason.servers.values()) {
        if (server.error) pendingErrors.push(server.error);
      }
    }
  }

  return false;
};

module.exports = { isDatabaseUnavailable };
