const prisma = require("../config/prisma");

const DEFAULT_APPROACHING_DAYS = 30;
const DEFAULT_APPROACHING_MILES = 1000;

const serviceRecordSelect = {
  id: true,
  serviceDate: true,
  odometerMileage: true,
  description: true,
  cost: true,
  nextDueDate: true,
  nextDueMileage: true,
  createdAt: true,
};

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseNonNegativeInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw validationError(`${fieldName} must be a non-negative whole number`);
  }
  return parsed;
}

function parseDate(value, fieldName) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw validationError(`${fieldName} must be a valid date`);
  }
  return date;
}

function parseImageUrl(value) {
  if (value === undefined || value === null || value === "") return null;
  const imageUrl = String(value).trim();
  try {
    const parsed = new URL(imageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    throw validationError("imageUrl must be a valid HTTP or HTTPS URL");
  }
  return imageUrl;
}

// Pass a decimal string to Prisma to preserve precision; never convert money to a JS number.
function parseCost(value) {
  const cost = String(value ?? "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(cost)) {
    throw validationError("cost must be a non-negative decimal with at most two fractional digits");
  }
  return cost;
}

function serializeServiceRecord(record) {
  return { ...record, cost: record.cost.toString() };
}

function dueStatus(vehicle, { days = DEFAULT_APPROACHING_DAYS, mileage = DEFAULT_APPROACHING_MILES } = {}) {
  const today = new Date();
  const dateThreshold = new Date(today);
  dateThreshold.setDate(dateThreshold.getDate() + days);
  const mileageThreshold = vehicle.odometerCurrent + mileage;

  const dateOverdue = vehicle.nextDueDate && vehicle.nextDueDate < today;
  const mileageOverdue = vehicle.nextDueMileage !== null && vehicle.nextDueMileage !== undefined
    && vehicle.nextDueMileage <= vehicle.odometerCurrent;
  const dateApproaching = vehicle.nextDueDate && vehicle.nextDueDate >= today && vehicle.nextDueDate <= dateThreshold;
  const mileageApproaching = vehicle.nextDueMileage !== null && vehicle.nextDueMileage !== undefined
    && vehicle.nextDueMileage > vehicle.odometerCurrent && vehicle.nextDueMileage <= mileageThreshold;

  return {
    status: dateOverdue || mileageOverdue ? "OVERDUE" : dateApproaching || mileageApproaching ? "APPROACHING" : "ON_TRACK",
    dateOverdue: Boolean(dateOverdue),
    mileageOverdue: Boolean(mileageOverdue),
    dateApproaching: Boolean(dateApproaching),
    mileageApproaching: Boolean(mileageApproaching),
  };
}

async function createVehicle(tenantId, data) {
  if (!data.registration?.trim()) throw validationError("registration is required");
  const odometerCurrent = parseNonNegativeInteger(data.odometerCurrent ?? 0, "odometerCurrent");

  let departmentId = null;
  if (data.departmentId && typeof data.departmentId === "string" && data.departmentId.trim()) {
    const department = await prisma.department.findFirst({
      where: { id: data.departmentId.trim(), tenantId },
    });
    if (!department) {
      throw validationError(`Department with ID '${data.departmentId}' does not exist for this tenant`);
    }
    departmentId = department.id;
  }

  try {
    return await prisma.vehicle.create({
      data: {
        tenantId,
        departmentId,
        registration: data.registration.trim(),
        make: data.make || null,
        model: data.model || null,
        imageUrl: parseImageUrl(data.imageUrl),
        odometerCurrent,
      },
    });
  } catch (error) {
    if (error.code === "P2003") {
      throw validationError("Invalid departmentId or tenantId referenced");
    }
    throw error;
  }
}

async function listVehicles(tenantId, options = {}) {
  const limit = options.limit === undefined ? 100 : parseNonNegativeInteger(options.limit, "limit");
  if (limit < 1 || limit > 500) throw validationError("limit must be between 1 and 500");
  const where = { tenantId };
  if (options.includeRetired !== "true") where.retiredAt = null;
  if (options.departmentId) where.departmentId = options.departmentId;
  return prisma.vehicle.findMany({
    where,
    include: { department: { select: { id: true, name: true, costCentreCode: true } } },
    orderBy: { registration: "asc" },
    take: limit,
  });
}

async function updateVehicle(tenantId, vehicleId, data) {
  const vehicle = await getTenantVehicle(tenantId, vehicleId);
  const updates = {};
  if (data.registration !== undefined) {
    if (!String(data.registration).trim()) throw validationError("registration is required");
    updates.registration = String(data.registration).trim();
  }
  if (data.make !== undefined) updates.make = data.make ? String(data.make).trim() : null;
  if (data.model !== undefined) updates.model = data.model ? String(data.model).trim() : null;
  if (data.odometerCurrent !== undefined) {
    const odometerCurrent = parseNonNegativeInteger(data.odometerCurrent, "odometerCurrent");
    if (odometerCurrent < vehicle.odometerCurrent) throw validationError("odometerCurrent cannot be lower than the recorded odometer");
    updates.odometerCurrent = odometerCurrent;
  }
  if (data.departmentId !== undefined) {
    if (!data.departmentId) updates.departmentId = null;
    else {
      const department = await prisma.department.findFirst({ where: { id: data.departmentId, tenantId } });
      if (!department) throw validationError("departmentId does not belong to this tenant");
      updates.departmentId = department.id;
    }
  }
  try {
    return await prisma.vehicle.update({ where: { id: vehicleId }, data: updates });
  } catch (error) {
    if (error.code === "P2002") throw validationError("A vehicle with this registration already exists");
    throw error;
  }
}

async function retireVehicle(tenantId, vehicleId) {
  await getTenantVehicle(tenantId, vehicleId);
  return prisma.vehicle.update({ where: { id: vehicleId }, data: { retiredAt: new Date() } });
}

async function getTenantVehicle(tenantId, vehicleId) {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } });
  if (!vehicle) {
    const error = new Error("Vehicle not found");
    error.statusCode = 404;
    throw error;
  }
  return vehicle;
}

async function updateOdometer(tenantId, vehicleId, odometerCurrent) {
  const vehicle = await getTenantVehicle(tenantId, vehicleId);
  const value = parseNonNegativeInteger(odometerCurrent, "odometerCurrent");
  if (value < vehicle.odometerCurrent) throw validationError("odometerCurrent cannot be lower than the recorded odometer");
  const updatedVehicle = await prisma.vehicle.update({ where: { id: vehicleId }, data: { odometerCurrent: value } });
  return { vehicle: updatedVehicle, maintenance: dueStatus(updatedVehicle) };
}

async function updateVehicleImage(tenantId, vehicleId, imageUrl) {
  await getTenantVehicle(tenantId, vehicleId);
  return prisma.vehicle.update({
    where: { id: vehicleId },
    data: { imageUrl: parseImageUrl(imageUrl) },
  });
}

async function logServiceRecord(tenantId, vehicleId, data) {
  const vehicle = await getTenantVehicle(tenantId, vehicleId);
  const odometerMileage = parseNonNegativeInteger(data.odometerMileage, "odometerMileage");
  const nextDueMileage = data.nextDueMileage === undefined || data.nextDueMileage === null || data.nextDueMileage === ""
    ? null : parseNonNegativeInteger(data.nextDueMileage, "nextDueMileage");
  const nextDueDate = data.nextDueDate ? parseDate(data.nextDueDate, "nextDueDate") : null;
  const warnings = [];

  const resultingOdometer = Math.max(vehicle.odometerCurrent, odometerMileage);
  if (nextDueMileage !== null && nextDueMileage < resultingOdometer) {
    warnings.push("nextDueMileage is below the vehicle's current odometer; the service is already overdue by mileage.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.serviceRecord.create({
      data: {
        vehicleId,
        serviceDate: parseDate(data.serviceDate, "serviceDate"),
        odometerMileage,
        description: data.description || null,
        cost: parseCost(data.cost),
        nextDueDate,
        nextDueMileage,
      },
      select: serviceRecordSelect,
    });

    const updatedVehicle = await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        odometerCurrent: resultingOdometer,
        nextDueDate,
        nextDueMileage,
      },
    });
    return { record, vehicle: updatedVehicle };
  });

  return { serviceRecord: serializeServiceRecord(result.record), warnings, maintenance: dueStatus(result.vehicle) };
}

async function listServiceHistory(tenantId, vehicleId) {
  await getTenantVehicle(tenantId, vehicleId);
  const records = await prisma.serviceRecord.findMany({
    where: { vehicleId }, select: serviceRecordSelect, orderBy: { serviceDate: "desc" },
  });
  return records.map(serializeServiceRecord);
}

async function findVehiclesApproachingMaintenance(tenantId, options = {}) {
  const days = parseNonNegativeInteger(options.days ?? DEFAULT_APPROACHING_DAYS, "days");
  const mileage = parseNonNegativeInteger(options.mileage ?? DEFAULT_APPROACHING_MILES, "mileage");
  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId, OR: [{ nextDueDate: { not: null } }, { nextDueMileage: { not: null } }] },
    orderBy: { registration: "asc" },
  });
  return vehicles.map((vehicle) => ({ ...vehicle, maintenance: dueStatus(vehicle, { days, mileage }) }))
    .filter((vehicle) => vehicle.maintenance.status !== "ON_TRACK");
}

module.exports = { createVehicle, listVehicles, updateVehicle, retireVehicle, updateOdometer, updateVehicleImage, logServiceRecord, listServiceHistory, findVehiclesApproachingMaintenance, dueStatus };
