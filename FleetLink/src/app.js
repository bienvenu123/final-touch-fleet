require("dotenv").config();

BigInt.prototype.toJSON = function () {
  return Number(this);
};

const express = require("express");
const authRoutes = require("./routes/auth.routes");
const errorHandler = require("./middleware/error.middleware");
const tenantRoutes = require("./routes/tenant.routes");
const departmentRoutes = require("./routes/department.routes");
const fleetRoutes = require("./routes/fleet.routes");
const vehicleRoutes = require("./routes/vehicle.routes");
const bookingRoutes = require("./routes/booking.routes");
const auditLogRoutes = require("./routes/audit-log.routes");
const rentalRoutes = require("./routes/rental.routes");
const customerRoutes = require("./routes/customer.routes");
const rentalInspectionRoutes = require("./routes/rentalInspection.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const rentalReportRoutes = require("./routes/rentalReport.routes");
const driverRoutes = require("./routes/driver.routes");
const tripRoutes = require("./routes/trip.routes");
const driverPortalRoutes = require("./routes/driver-portal.routes");
const customerPortalRoutes = require("./routes/customer-portal.routes");
const financePortalRoutes = require("./routes/finance-portal.routes");
const entitlementRoutes = require("./routes/entitlement.routes");
const adminRoutes = require("./routes/admin.routes");
const publicFleetRoutes = require("./routes/public-fleet.routes");
const contactMessageRoutes = require("./routes/contact-message.routes");
const auditLogMiddleware = require("./middleware/audit-log.middleware");

const app=express();

app.set("trust proxy", true);
app.use((req, res, next) => {
  const origin = req.get("origin");
  const configuredOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const isExpoDevelopmentOrigin =
    process.env.NODE_ENV !== "production" &&
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || "");
  const isAllowedOrigin = configuredOrigins.includes(origin) || isExpoDevelopmentOrigin;

  if (origin && isAllowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return isAllowedOrigin ? res.sendStatus(204) : res.sendStatus(403);
  next();
});
app.use(express.json());
app.use(auditLogMiddleware);
app.use("/auth",authRoutes);
app.use("/tenants", tenantRoutes);
app.use("/departments", departmentRoutes);
app.use("/fleet", fleetRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/rental-reservations", rentalRoutes);
app.use("/api/rental-reservations/:reservationId/inspections", rentalInspectionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reports", rentalReportRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/driver-portal", driverPortalRoutes);
app.use("/api/customer-portal", customerPortalRoutes);
app.use("/api/finance-portal", financePortalRoutes);
app.use("/api/entitlements", entitlementRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicFleetRoutes);
app.use("/api/contact-messages", contactMessageRoutes);
app.use(errorHandler);

module.exports=app;
