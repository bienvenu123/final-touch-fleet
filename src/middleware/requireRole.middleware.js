/**
 * Restrict a route to authenticated users with one of the allowed roles.
 *
 * `auth.middleware` must run before this middleware so `req.user` is present.
 */
const requireRole = (allowedRoles) => {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    throw new TypeError("requireRole expects a non-empty array of roles");
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
};

module.exports = requireRole;
