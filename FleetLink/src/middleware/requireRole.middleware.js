/**
 * Restrict a route to authenticated users with one of the allowed roles.
 *
 * `auth.middleware` must run before this middleware so `req.user` is present.
 */
const requireRole = (allowedRoles) => {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    throw new TypeError("requireRole expects a non-empty array of roles");
  }

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // A system administrator is the tenant's unrestricted operator.  Keeping
    // this override here makes it apply to every service that uses role-based
    // access control, including services added in the future.
    if (req.user.role !== "SUPER_ADMIN") {
      const tenantId = req.user.tenantId;
      if (tenantId) {
        const prisma = require("../config/prisma");
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { roleConfiguration: true } });
        const rolePermissions = tenant?.roleConfiguration?.permissions?.[req.user.role];
        if (Array.isArray(rolePermissions)) {
          const route = `${req.baseUrl || ""}${req.route?.path || req.path}`.replace(/\/+$/, "") || "/";
          const permission = `${req.method.toUpperCase()}:${route}`;
          if (rolePermissions.includes(permission)) return next();
          return res.status(403).json({ message: "Forbidden" });
        }
      }
      if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
};

module.exports = requireRole;
