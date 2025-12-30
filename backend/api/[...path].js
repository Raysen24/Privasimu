const app = require("../src/app");

module.exports = (req, res) => {
  // Vercel strips the /api prefix before Express sees it.
  // Your Express app expects routes starting with /api, so we add it back.
  if (!req.url.startsWith("/api")) req.url = "/api" + req.url;
  return app(req, res);
};
