const rentalReservationService = require("../services/rentalReservation.service");

async function createRentalReservation(req, res, next) {
  try {
    const reservation = await rentalReservationService.createRentalReservation(req.user.tenantId, req.body);
    res.status(201).json({ reservation });
  } catch (error) {
    next(error);
  }
}

async function requestRentalExtension(req, res, next) {
  try {
    const reservation = await rentalReservationService.requestRentalExtension(
      req.user.tenantId,
      req.params.reservationId,
      req.body
    );
    res.status(200).json({ reservation });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRentalReservation,
  requestRentalExtension,
};
