require("dotenv").config();

const app = require("./app");
const { startBoss, stopBoss } = require("./config/boss");
const { registerFleetBackgroundJobs } = require("./jobs/maintenance-check.job");

const PORT = process.env.PORT || 3000;

async function main() {
  const boss = await startBoss();
  if (boss) {
    await registerFleetBackgroundJobs(boss);
    console.log("Background job workers registered");
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await stopBoss();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Server failed to start", error);
  process.exit(1);
});
