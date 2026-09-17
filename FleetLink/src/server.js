require("dotenv").config();

const app = require("./app");
const { startBoss, stopBoss } = require("./config/boss");
const { registerFleetBackgroundJobs } = require("./jobs/maintenance-check.job");

const PORT = process.env.PORT || 3000;

async function main() {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Background jobs are optional. Do not prevent the API from serving booking
  // requests when the database has temporarily run out of queue connections.
  if (process.env.ENABLE_BACKGROUND_JOBS === "true") {
    startBoss()
      .then(async (boss) => {
        if (!boss) return;
        await registerFleetBackgroundJobs(boss);
        console.log("Background job workers registered");
      })
      .catch((error) => console.error("Background jobs unavailable", error.message));
  } else {
    console.log("Background jobs disabled; set ENABLE_BACKGROUND_JOBS=true to enable them");
  }

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
