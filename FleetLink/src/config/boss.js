const { PgBoss } = require("pg-boss");
const prisma = require("./prisma");

let bossInstance = null;
let bossStarting = null;

async function startBoss() {
  if (bossInstance) return bossInstance;
  if (bossStarting) return bossStarting;

  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set; background jobs are disabled");
    return null;
  }

  const pending = (async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL);
    databaseUrl.searchParams.delete("sslmode");

    const boss = new PgBoss({
      connectionString: databaseUrl.toString(),
      ssl: { rejectUnauthorized: false },
      // Keep the pg-boss pool small so it doesn't exhaust Aiven's connection limit
      // alongside the Prisma pool. Adjust max if your plan allows more connections.
      max: 3,
      connectionTimeoutMillis: 30_000,
      idleTimeoutMillis: 60_000,
      // Reduce internal polling frequency to ease connection pressure
      monitorStateIntervalSeconds: 30,
      // Retry failed jobs with exponential backoff instead of hammering the DB
      retryBackoff: true,
      retryLimit: 3,
    });
    boss.on("error", (error) => console.error("pg-boss error", error.message));
    await boss.start();
    bossInstance = boss;
    bossStarting = null;
    return bossInstance;
  })();
  bossStarting = pending.catch((error) => {
    bossStarting = null;
    throw error;
  });
  return bossStarting;
}

function getBoss() {
  return bossInstance;
}

async function getBossForPublishing() {
  const boss = bossInstance || await startBoss();
  if (!boss) {
    const error = new Error("Background jobs need DATABASE_URL and a reachable PostgreSQL database");
    error.statusCode = 503;
    throw error;
  }
  await boss.createQueue("rental-performance-report");
  return boss;
}

async function stopBoss() {
  if (!bossInstance) return;
  await bossInstance.stop();
  bossInstance = null;
}

module.exports = { startBoss, getBoss, getBossForPublishing, stopBoss };
