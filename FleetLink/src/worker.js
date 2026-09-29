require("dotenv").config();

const { startBoss, stopBoss } = require("./config/boss");
const { registerFleetBackgroundJobs } = require("./jobs/maintenance-check.job");
const { registerConfiguredNotificationAdapters } = require("./config/notification-providers");

async function main() {
  const boss = await startBoss();
  if (!boss) throw new Error("DATABASE_URL is required to start the FleetLink worker");

  const channels = registerConfiguredNotificationAdapters();
  await registerFleetBackgroundJobs(boss);
  console.log(`FleetLink worker started; notification channels: ${channels.join(", ")}`);

  const shutdown = async () => {
    await stopBoss();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch(async (error) => {
  console.error("FleetLink worker failed to start", error);
  await stopBoss();
  process.exit(1);
});
