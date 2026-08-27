const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");

function validationError(message) { const error = new Error(message); error.statusCode = 400; return error; }
function notFound(message) { const error = new Error(message); error.statusCode = 404; return error; }
function limit(value) { const parsed = Number(value ?? 100); if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) throw validationError("limit must be a whole number between 1 and 500"); return parsed; }

async function listDepartments(tenantId) {
  return prisma.department.findMany({ where: { tenantId }, orderBy: { name: "asc" }, include: { _count: { select: { users: true, vehicles: true } } } });
}
async function createDepartment(tenantId, data) {
  if (!data.name?.trim()) throw validationError("name is required");
  return prisma.department.create({ data: { tenantId, name: data.name.trim(), costCentreCode: data.costCentreCode?.trim() || null, budgetCode: data.budgetCode?.trim() || null } });
}
async function updateDepartment(tenantId, id, data) {
  const found = await prisma.department.findFirst({ where: { id, tenantId } }); if (!found) throw notFound("Department not found");
  if (data.name !== undefined && !String(data.name).trim()) throw validationError("name cannot be empty");
  return prisma.department.update({ where: { id }, data: { ...(data.name !== undefined ? { name: data.name.trim() } : {}), ...(data.costCentreCode !== undefined ? { costCentreCode: data.costCentreCode?.trim() || null } : {}), ...(data.budgetCode !== undefined ? { budgetCode: data.budgetCode?.trim() || null } : {}) } });
}
async function deleteDepartment(tenantId, id) {
  const found = await prisma.department.findFirst({ where: { id, tenantId }, include: { _count: { select: { users: true, vehicles: true } } } }); if (!found) throw notFound("Department not found");
  if (found._count.users || found._count.vehicles) throw validationError("Reassign department users and vehicles before deletion");
  return prisma.department.delete({ where: { id } });
}

async function listUsers(tenantId, options = {}) {
  return prisma.user.findMany({ where: { tenantId }, select: { id: true, name: true, email: true, role: true, contact: true, isActive: true, licenceExpiry: true, departmentId: true, department: { select: { name: true } } }, orderBy: { name: "asc" }, take: limit(options.limit) });
}
async function createUser(tenantId, data) {
  if (!data.name?.trim() || !data.email?.trim() || !data.password) throw validationError("name, email, and password are required");
  const allowedRoles = ["STAFF", "DEPARTMENT_HEAD", "FLEET_MANAGER", "SUPER_ADMIN"]; if (!allowedRoles.includes(data.role)) throw validationError("role is invalid");
  if (data.departmentId) { const department = await prisma.department.findFirst({ where: { id: data.departmentId, tenantId } }); if (!department) throw validationError("departmentId does not belong to this tenant"); }
  try { return await prisma.user.create({ data: { tenantId, name: data.name.trim(), email: data.email.trim().toLowerCase(), password: await bcrypt.hash(data.password, 10), role: data.role, departmentId: data.departmentId || null, contact: data.contact?.trim() || null } }); }
  catch (error) { if (error.code === "P2002") throw validationError("A user with this email already exists"); throw error; }
}
async function updateUser(tenantId, id, data) {
  const found = await prisma.user.findFirst({ where: { id, tenantId } }); if (!found) throw notFound("User not found");
  const allowedRoles = ["STAFF", "DEPARTMENT_HEAD", "FLEET_MANAGER", "SUPER_ADMIN"]; if (data.role && !allowedRoles.includes(data.role)) throw validationError("role is invalid");
  if (data.departmentId) { const department = await prisma.department.findFirst({ where: { id: data.departmentId, tenantId } }); if (!department) throw validationError("departmentId does not belong to this tenant"); }
  const updates = ["name", "role", "contact", "isActive", "departmentId"].reduce((result, key) => data[key] !== undefined ? { ...result, [key]: key === "name" || key === "contact" ? (data[key]?.trim() || null) : data[key] } : result, {});
  if (data.password) updates.password = await bcrypt.hash(data.password, 10);
  return prisma.user.update({ where: { id }, data: updates, select: { id: true, name: true, email: true, role: true, contact: true, isActive: true, departmentId: true } });
}
async function deactivateUser(tenantId, id, actorId) {
  if (id === actorId) throw validationError("You cannot deactivate your own account");
  const found = await prisma.user.findFirst({ where: { id, tenantId } }); if (!found) throw notFound("User not found");
  return prisma.user.update({ where: { id }, data: { isActive: false }, select: { id: true, email: true, isActive: true } });
}

module.exports = { listDepartments, createDepartment, updateDepartment, deleteDepartment, listUsers, createUser, updateUser, deactivateUser };
