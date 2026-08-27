require("dotenv").config();

const bcrypt = require("bcrypt");
const prisma = require("../src/config/prisma");

const email = process.env.FLEETLINK_ADMIN_EMAIL;
const password = process.env.FLEETLINK_ADMIN_PASSWORD;
const tenantName = process.env.FLEETLINK_ADMIN_TENANT || "Corporate Fleet Services";

async function main() {
  if (!email || !password) throw new Error("FLEETLINK_ADMIN_EMAIL and FLEETLINK_ADMIN_PASSWORD are required");
  const tenant = await prisma.tenant.findFirst({ where: { name: tenantName } });
  if (!tenant) throw new Error(`Tenant '${tenantName}' was not found`);

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { password: await bcrypt.hash(password, 10), role: "SUPER_ADMIN", tenantId: tenant.id, isActive: true },
    create: { name: email.split("@")[0], email: email.toLowerCase(), password: await bcrypt.hash(password, 10), role: "SUPER_ADMIN", tenantId: tenant.id, isActive: true },
    select: { email: true, role: true, tenantId: true },
  });
  console.log(`Admin account ready: ${user.email} (${user.role}) in tenant ${user.tenantId}`);
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
