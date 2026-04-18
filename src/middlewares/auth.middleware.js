const jwt = require("jsonwebtoken");
const config = require("../config");

/**
 * Verify JWT from Authorization: Bearer <token> header.
 * Attaches decoded payload to req.user.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid Authorization header",
        },
      });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    req.user = payload; // { user_id, source, ... }
    next();
  } catch (err) {
    const code =
      err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
    return res
      .status(401)
      .json({ success: false, error: { code, message: err.message } });
  }
}

module.exports = authMiddleware;
