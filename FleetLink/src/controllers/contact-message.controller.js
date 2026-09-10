const contactMessages = require("../services/contact-message.service");

async function listContactMessages(req, res, next) {
  try {
    res.json({ contactMessages: await contactMessages.listContactMessages(req.user.tenantId, req.query) });
  } catch (error) { next(error); }
}

async function updateContactMessageStatus(req, res, next) {
  try {
    res.json({ contactMessage: await contactMessages.updateContactMessageStatus(req.user.tenantId, req.params.id, req.body.status) });
  } catch (error) { next(error); }
}

module.exports = { listContactMessages, updateContactMessageStatus };
