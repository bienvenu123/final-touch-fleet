const rentalReservationService = require("../services/rentalReservation.service");

async function createRentalCheckout(req, res, next) {
  try {
    const reservation = await rentalReservationService.createRentalCheckout(
      req.user.tenantId,
      req.params.reservationId,
      req.body
    );
    res.status(201).json({ reservation });
  } catch (error) {
    next(error);
  }
}

async function createRentalCheckin(req, res, next) {
  try {
    const reservation = await rentalReservationService.createRentalCheckin(
      req.user.tenantId,
      req.params.reservationId,
      req.body
    );
    res.status(201).json({ reservation });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRentalCheckout,
  createRentalCheckin,
};
