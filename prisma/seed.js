require("dotenv").config();

const bcrypt = require("bcrypt");
const prisma = require("../src/config/prisma");

const TEST_PASSWORD = "FleetLink-Test-Password-2026";

const tenants = [
  {
    name: "Corporate Fleet Services",
    sector: "Corporate",
    package: "Enterprise",
    billingStatus: "ACTIVE",
    emailPrefix: "corporate",
  },
  {
    name: "Rental Fleet Services",
    sector: "Rental",
    package: "Professional",
    billingStatus: "ACTIVE",
    emailPrefix: "rental",
  },
];

const roles = ["SUPER_ADMIN", "FLEET_MANAGER", "DEPARTMENT_HEAD", "STAFF"];

async function getOrCreateTenant(data) {
  const existingTenant = await prisma.tenant.findFirst({
    where: { name: data.name },
  });

  if (existingTenant) {
    return existingTenant;
  }

  return prisma.tenant.create({
    data: {
      name: data.name,
      sector: data.sector,
      package: data.package,
      billingStatus: data.billingStatus,
    },
  });
}

async function seedFleetData(tenant, emailPrefix) {
  const vehicles = [
    { registration: `${emailPrefix.toUpperCase()}-001`, make: "Toyota", model: "Corolla" },
    { registration: `${emailPrefix.toUpperCase()}-002`, make: "Ford", model: "Transit" },
    { registration: `${emailPrefix.toUpperCase()}-003`, make: "VW", model: "Caddy" },
  ];

  const createdVehicles = [];
  for (const vehicle of vehicles) {
    const record = await prisma.vehicle.upsert({
      where: {
        tenantId_registration: {
          tenantId: tenant.id,
          registration: vehicle.registration,
        },
      },
      update: {
        make: vehicle.make,
        model: vehicle.model,
        retiredAt: null,
      },
      create: {
        tenantId: tenant.id,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
      },
    });
    createdVehicles.push(record);
  }

  if (emailPrefix !== "corporate") {
    return createdVehicles;
  }

  const staffUser = await prisma.user.findUnique({
    where: { email: "staff.corporate@fleetlink.test" },
  });
  if (!staffUser) {
    throw new Error("Expected corporate staff user for booking seed data");
  }

  const [bookedVehicle, adjacentVehicle, cancelledVehicle] = createdVehicles;
  const bookings = [
    {
      id: "seed-booking-approved-overlap",
      vehicleId: bookedVehicle.id,
      requestedById: staffUser.id,
      kind: "CORPORATE",
      status: "APPROVED",
      justification: "Executive site visit",
      passengerCount: 2,
      startAt: new Date("2026-08-12T09:00:00.000Z"),
      endAt: new Date("2026-08-12T11:00:00.000Z"),
      approvedAt: new Date("2026-08-11T12:00:00.000Z"),
    },
    {
      id: "seed-booking-approved-adjacent",
      vehicleId: adjacentVehicle.id,
      requestedById: staffUser.id,
      kind: "RENTAL",
      status: "APPROVED",
      justification: "Client airport transfer",
      passengerCount: 4,
      startAt: new Date("2026-08-12T08:00:00.000Z"),
      endAt: new Date("2026-08-12T10:00:00.000Z"),
      approvedAt: new Date("2026-08-11T12:00:00.000Z"),
    },
    {
      id: "seed-booking-cancelled",
      vehicleId: cancelledVehicle.id,
      requestedById: staffUser.id,
      kind: "CORPORATE",
      status: "CANCELLED",
      justification: "Training day transport",
      passengerCount: 3,
      startAt: new Date("2026-08-12T09:00:00.000Z"),
      endAt: new Date("2026-08-12T12:00:00.000Z"),
    },
    {
      id: "seed-booking-rejected",
      vehicleId: bookedVehicle.id,
      requestedById: staffUser.id,
      kind: "RENTAL",
      status: "REJECTED",
      justification: "Weekend personal trip",
      passengerCount: 1,
      comment: "Vehicle already reserved for corporate use",
      startAt: new Date("2026-08-12T12:00:00.000Z"),
      endAt: new Date("2026-08-12T14:00:00.000Z"),
      rejectedAt: new Date("2026-08-11T13:00:00.000Z"),
    },
  ];

  for (const booking of bookings) {
    await prisma.booking.upsert({
      where: { id: booking.id },
      update: booking,
      create: { tenantId: tenant.id, ...booking },
    });
  }

  return createdVehicles;
}

async function main() {
  const password = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const tenantData of tenants) {
    const tenant = await getOrCreateTenant(tenantData);

    for (const role of roles) {
      const email = `${role.toLowerCase()}.${tenantData.emailPrefix}@fleetlink.test`;
      await prisma.user.upsert({
        where: { email },
        update: {
          name: `${role.replace("_", " ")} (${tenantData.sector})`,
          password,
          role,
          tenantId: tenant.id,
        },
        create: {
          name: `${role.replace("_", " ")} (${tenantData.sector})`,
          email,
          password,
          role,
          tenantId: tenant.id,
        },
      });
    }

    await seedFleetData(tenant, tenantData.emailPrefix);
  }

  console.log("Seed complete: 2 tenants, 3 test users per tenant, and sample fleet bookings.");
  console.log(`All seeded users use password: ${TEST_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
