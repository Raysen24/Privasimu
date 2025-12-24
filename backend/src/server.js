const app = require("./app");
const scheduler = require("./services/scheduler");

const PORT = process.env.PORT || 4000;

// Start the server
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
  
  // Start scheduled jobs
  scheduler.start();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  scheduler.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  scheduler.stop();
  process.exit(0);
});
