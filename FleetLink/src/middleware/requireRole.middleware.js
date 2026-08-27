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

    // A system administrator is the tenant's unrestricted operator.  Keeping
    // this override here makes it apply to every service that uses role-based
    // access control, including services added in the future.
    if (req.user.role !== "SUPER_ADMIN" && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
};

module.exports = requireRole;
