const { db } = require("../firebase");

/**
 * Lightweight auth context for API requests.
 *
 * The frontend already sends:
 *  - x-user-id
 *  - x-user-email
 *
 * This middleware:
 *  - attaches req.user = { uid, email, role, name }
 *  - uses Firestore `users/{uid}` to enrich role/name when available
 */
module.exports = async function userContext(req, _res, next) {
  const uid = req.headers["x-user-id"];
  const email = req.headers["x-user-email"];

  if (!uid) return next();

  try {
    const snap = await db.collection("users").doc(uid).get();
    if (snap.exists) {
      const data = snap.data() || {};
      req.user = {
        uid,
        email: email || data.email,
        role: data.role,
        name: data.name,
      };
    } else {
      req.user = { uid, email };
    }
  } catch (err) {
    // Don't block requests if lookup fails
    req.user = { uid, email };
  }

  return next();
};
