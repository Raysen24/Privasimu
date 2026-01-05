const express = require("express");
const cors = require("cors");

const { db } = require("./firebase");
const accessLogger = require("./middleware/accessLogger");
const userContext = require("./middleware/userContext");

// Import routes
const regulationsRoutes = require("./routes/regulations");
const usersRoutes = require("./routes/users");
const statisticsRoutes = require("./routes/statistics");
const deadlinesRoutes = require("./routes/deadlines");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(userContext);
app.use(accessLogger); // Log all API access

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Test route for debugging
app.get('/api/debug/test', (req, res) => {
  console.log('Test route hit!');
  res.json({ success: true, message: 'Debug test route is working', timestamp: new Date() });
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Test route
app.get("/test", async (req, res) => {
  try {
    const testDoc = await db.collection("test").add({
      message: "Firebase connected!",
      timestamp: new Date(),
    });

    res.json({ success: true, id: testDoc.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API Routes
app.use("/api/regulations", regulationsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/deadlines", deadlinesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

module.exports = app;

