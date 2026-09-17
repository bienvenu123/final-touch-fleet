const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const databaseUrl = new URL(process.env.DATABASE_URL);

// `pg` lets SSL options in the connection string override the explicit `ssl`
// configuration. Remove sslmode so this pool uses the configuration below.
databaseUrl.searchParams.delete("sslmode");

const pool = new Pool({
  connectionString: databaseUrl.toString(),
  // Hosted development databases often have very small connection limits.
  // Keep the API pool deliberately small; Prisma queues concurrent requests.
  max: Number(process.env.DATABASE_POOL_MAX || 1),
  connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 10_000),
  ssl: {
    rejectUnauthorized: false,
  },
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;
