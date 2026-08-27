const bookingService = require("../services/booking.service");

async function listBookings(req, res, next) {
  try { res.json({ bookings: await bookingService.listBookings(req.user.tenantId, req.query, req.user) }); }
  catch (error) { next(error); }
}

async function submitBooking(req, res, next) {
  try {
    const actorId = req.user.userId ?? req.user.id;
    const booking = await bookingService.createBooking(req.user.tenantId, actorId, req.body);
    res.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
}

async function approveBooking(req, res, next) {
  try {
    req.auditMeta = {
      action: "APPROVE",
      entityType: "BOOKING",
      entityId: req.params.bookingId,
    };
    const booking = await bookingService.approveBooking(req.user.tenantId, req.params.bookingId, req.user);
    res.json({ booking });
  } catch (error) {
    next(error);
  }
}

async function rejectBooking(req, res, next) {
  try {
    req.auditMeta = {
      action: "REJECT",
      entityType: "BOOKING",
      entityId: req.params.bookingId,
    };
    const booking = await bookingService.rejectBooking(req.user.tenantId, req.params.bookingId, req.user, req.body);
    res.json({ booking });
  } catch (error) {
    next(error);
  }
}

module.exports = { listBookings, submitBooking, approveBooking, rejectBooking };
