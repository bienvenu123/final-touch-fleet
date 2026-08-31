const customerService = require("../services/customer.service");

async function createCustomer(req, res, next) {
  try {
    const customer = await customerService.createCustomer(req.user.tenantId, req.body);
    res.status(201).json({ customer });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCustomer,
};
