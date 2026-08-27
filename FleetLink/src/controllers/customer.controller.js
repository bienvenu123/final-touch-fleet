const customerService = require("../services/customer.service");

async function listCustomers(req, res, next) {
  try { res.json({ customers: await customerService.listCustomers(req.user.tenantId, req.query) }); }
  catch (error) { next(error); }
}

async function createCustomer(req, res, next) {
  try {
    const customer = await customerService.createCustomer(req.user.tenantId, req.body);
    res.status(201).json({ customer });
  } catch (error) {
    next(error);
  }
}

async function updateCustomer(req, res, next) {
  try { res.json({ customer: await customerService.updateCustomer(req.user.tenantId, req.params.customerId, req.body) }); }
  catch (error) { next(error); }
}

async function deleteCustomer(req, res, next) {
  try { res.json({ customer: await customerService.deleteCustomer(req.user.tenantId, req.params.customerId) }); }
  catch (error) { next(error); }
}

module.exports = {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
