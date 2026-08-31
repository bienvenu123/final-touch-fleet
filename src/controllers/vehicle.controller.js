const prisma = require("../config/prisma");
const vehicleAvailabilityService = require("../services/vehicle-availability.service");

async function getAvailableVehicles(req, res, next) {
  try {
    const result = await vehicleAvailabilityService.findAvailableVehicles(req.user.tenantId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function listVehicles(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const { status, departmentId } = req.query;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        retiredAt: null,
        ...(status ? { status } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      include: { department: { select: { id: true, name: true } } },
      orderBy: { registration: "asc" },
    });

    res.json({ vehicles });
  } catch (error) {
    next(error);
  }
}

async function createVehicle(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const { registration, make, model, year, fuelType, ownershipStatus, branch, status, departmentId, odometerCurrent } = req.body;

    if (!registration) {
      return res.status(400).json({ message: "registration is required" });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        tenantId,
        registration,
        make: make || null,
        model: model || null,
        year: year ? Number(year) : null,
        fuelType: fuelType || null,
        ownershipStatus: ownershipStatus || null,
        branch: branch || null,
        status: status || "AVAILABLE",
        departmentId: departmentId || null,
        odometerCurrent: odometerCurrent ? Number(odometerCurrent) : 0,
      },
    });

    res.status(201).json({ message: "Vehicle created successfully", vehicle });
  } catch (error) {
    next(error);
  }
}

async function updateVehicleStatus(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, tenantId },
    });

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status },
    });

    res.json({ message: "Vehicle status updated successfully", vehicle: updated });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAvailableVehicles, listVehicles, createVehicle, updateVehicleStatus };
