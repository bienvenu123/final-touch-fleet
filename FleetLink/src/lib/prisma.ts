import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getTenantId } from "./asyncLocal";

const databaseUrl = new URL(process.env.DATABASE_URL!);
databaseUrl.searchParams.delete("sslmode");

const pool = new Pool({
  connectionString: databaseUrl.toString(),
  ssl: {
    rejectUnauthorized: false,
  },
  // Cap pool size so Prisma + pg-boss together stay within Aiven's connection limit.
  max: 5,
  connectionTimeoutMillis: 30_000,
  idleTimeoutMillis: 60_000,
});

const adapter = new PrismaPg(pool);

const basePrisma = new PrismaClient({
  adapter,
  log: [
    { level: "query", emit: "event" },
    { level: "info", emit: "event" },
    { level: "warn", emit: "event" },
    { level: "error", emit: "event" },
  ],
});

const tenantScopedModels = new Set(["Project", "User", "Department", "Vehicle", "Booking", "RentalReservation", "Customer", "Driver", "Trip"]);

function withTenantScope(where: unknown, tenantId: string) {
  if (!where) {
    return { tenantId };
  }

  return { AND: [where, { tenantId }] };
}

function injectTenantData(data: unknown, tenantId: string) {
  if (Array.isArray(data)) {
    return data.map((item) => ({ ...(item as object), tenantId }));
  }

  return { ...(data as object), tenantId };
}

const extendedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = getTenantId();
        if (!tenantId || !model || !tenantScopedModels.has(model)) {
          return query(args);
        }

        const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
        const dbModel = (basePrisma as any)[modelKey];
        // `args` is a union of all possible operation arg types across all models.
        // Direct property assignment fails type-checking on the union, so we cast to `any`.
        // The runtime shape is always correct because we guard on `operation` first.
        const anyArgs = args as any;

        if (operation === "create" || operation === "createMany") {
          anyArgs.data = injectTenantData(anyArgs.data, tenantId);
          return query(anyArgs);
        }

        if (["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy", "updateMany", "deleteMany"].includes(operation)) {
          anyArgs.where = withTenantScope(anyArgs.where, tenantId);
          return query(anyArgs);
        }

        if (operation === "findUnique") {
          return dbModel.findFirst({
            ...anyArgs,
            where: withTenantScope(anyArgs.where, tenantId),
          });
        }

        if (operation === "findUniqueOrThrow") {
          return dbModel.findFirstOrThrow({
            ...anyArgs,
            where: withTenantScope(anyArgs.where, tenantId),
          });
        }

        if (operation === "update") {
          return dbModel.updateMany({
            where: withTenantScope(anyArgs.where, tenantId),
            data: anyArgs.data,
          });
        }

        if (operation === "delete") {
          return dbModel.deleteMany({
            where: withTenantScope(anyArgs.where, tenantId),
          });
        }

        if (operation === "upsert") {
          anyArgs.where = withTenantScope(anyArgs.where, tenantId);
          anyArgs.create = injectTenantData(anyArgs.create, tenantId);
          return query(anyArgs);
        }

        return query(args);
      },
    },
  },
});

const prisma = extendedPrisma as unknown as PrismaClient;

export default prisma;
