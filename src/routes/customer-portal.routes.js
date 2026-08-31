const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const authMiddleware = require("../middleware/auth.middleware");

router.use(authMiddleware);

// GET /api/customer-portal/my-reservations
router.get("/my-reservations", async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const userEmail = req.user.email;

    const customer = await prisma.customer.findFirst({
      where: { tenantId, email: userEmail },
    });

    if (!customer) {
      return res.json({ customer: null, reservations: [] });
    }

    const reservations = await prisma.rentalReservation.findMany({
      where: { tenantId, customerId: customer.id },
      include: {
        vehicle: { select: { id: true, registration: true, make: true, model: true } },
        inspections: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ customer, reservations });
  } catch (error) {
    next(error);
  }
});

// GET /api/customer-portal/my-inspections
router.get("/my-inspections", async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const userEmail = req.user.email;

    const customer = await prisma.customer.findFirst({
      where: { tenantId, email: userEmail },
    });

    if (!customer) {
      return res.json({ customer: null, inspections: [] });
    }

    const inspections = await prisma.rentalInspection.findMany({
      where: { reservation: { tenantId, customerId: customer.id } },
      include: { reservation: { select: { id: true, vehicle: { select: { registration: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ customer, inspections });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
