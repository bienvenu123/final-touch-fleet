const admin = require("../services/admin.service");
const handler = (method, field, status = 200) => async (req, res, next) => { try { const value = await method(req.user.tenantId, req.params.id, req.body, req.user.userId); res.status(status).json({ [field]: value }); } catch (error) { next(error); } };

const listDepartments = async (req, res, next) => { try { res.json({ departments: await admin.listDepartments(req.user.tenantId) }); } catch (error) { next(error); } };
const createDepartment = handler((tenantId, _id, body) => admin.createDepartment(tenantId, body), "department", 201);
const updateDepartment = handler((tenantId, id, body) => admin.updateDepartment(tenantId, id, body), "department");
const deleteDepartment = async (req, res, next) => { try { res.json({ department: await admin.deleteDepartment(req.user.tenantId, req.params.id) }); } catch (error) { next(error); } };
const listUsers = async (req, res, next) => { try { res.json({ users: await admin.listUsers(req.user.tenantId, req.query) }); } catch (error) { next(error); } };
const createUser = handler((tenantId, _id, body) => admin.createUser(tenantId, body), "user", 201);
const updateUser = handler((tenantId, id, body) => admin.updateUser(tenantId, id, body), "user");
const deactivateUser = async (req, res, next) => { try { res.json({ user: await admin.deactivateUser(req.user.tenantId, req.params.id, req.user.userId) }); } catch (error) { next(error); } };
module.exports = { listDepartments, createDepartment, updateDepartment, deleteDepartment, listUsers, createUser, updateUser, deactivateUser };
