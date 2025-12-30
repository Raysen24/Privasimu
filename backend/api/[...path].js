const app = require("../src/app");
const url = require("url");

module.exports = (req, res) => {
  // Vercel catch-all routes commonly provide the path segments in req.query.path
  const parsed = url.parse(req.url || "", true);

  const pathParam =
    (req.query && (req.query.path || req.query["...path"])) ||
    parsed.query.path ||
    parsed.query["...path"];

  let pathname;
  if (Array.isArray(pathParam)) {
    pathname = "/" + pathParam.join("/");
  } else if (typeof pathParam === "string" && pathParam.length) {
    pathname = "/" + pathParam;
  } else {
    pathname = parsed.pathname || "/";
  }

  // Ensure exactly one /api prefix (your Express app mounts routes under /api/*)
  pathname = pathname.replace(/^\/api\/api\b/, "/api");
  if (!pathname.startsWith("/api")) pathname = "/api" + pathname;

  // Keep real query params, remove Vercel internal catch-all params
  const q = { ...(parsed.query || {}) };
  delete q.path;
  delete q["...path"];

  const qs = new url.URLSearchParams(q).toString();
  req.url = pathname + (qs ? `?${qs}` : "");

  return app(req, res);
};
