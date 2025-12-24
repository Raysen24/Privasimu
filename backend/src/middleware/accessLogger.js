const { db } = require("../firebase");

/**
 * Middleware to log all API access
 */
const accessLogger = async (req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date();

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    res.send = originalSend;
    
    // Log the access asynchronously (don't block the response)
    logAccess(req, res, startTime, timestamp, data).catch((err) => {
      console.error("Error logging access:", err);
    });

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Log access to Firestore
 */
async function logAccess(req, res, startTime, timestamp, responseData) {
  try {
    const duration = Date.now() - startTime;
    
    // Extract user info if available (from auth token, session, etc.)
    const userId = req.user?.id || req.headers["x-user-id"] || null;
    const userEmail = req.user?.email || req.headers["x-user-email"] || null;

    const logEntry = {
      method: req.method,
      path: req.path,
      url: req.originalUrl || req.url,
      query: req.query,
      statusCode: res.statusCode,
      duration: duration, // milliseconds
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("user-agent") || "",
      userId: userId,
      userEmail: userEmail,
      timestamp: timestamp,
      // Only log response size for non-sensitive endpoints
      responseSize: typeof responseData === "string" ? responseData.length : 0,
    };

    await db.collection("access_logs").add(logEntry);
  } catch (error) {
    // Don't throw - logging should never break the application
    console.error("Failed to log access:", error);
  }
}

module.exports = accessLogger;

