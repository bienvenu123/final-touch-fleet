import assert from "assert";
import http from "http";
import jwt from "jsonwebtoken";
import { createApp } from "./serverApp";
import prisma from "./lib/prisma";

function requestJson(server: http.Server, path: string, options: http.RequestOptions & { body?: string } = {}) {
  return new Promise<{ statusCode?: number; body: string }>((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === "string") {
      reject(new Error("Server is not listening"));
      return;
    }

    const req = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        path,
        method: options.method ?? "GET",
        headers: options.headers ?? {},
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, body });
        });
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function main() {
  const tenantA = await prisma.tenant.create({ data: { name: `tenant-a-${Date.now()}`, sector: "test", package: "basic", billingStatus: "active" } });
  const tenantB = await prisma.tenant.create({ data: { name: `tenant-b-${Date.now()}`, sector: "test", package: "basic", billingStatus: "active" } });

  await prisma.project.createMany({
    data: [
      { name: "tenant-a-project", tenantId: tenantA.id },
      { name: "tenant-b-project", tenantId: tenantB.id },
    ],
  });

  const token = jwt.sign({ sub: "tenant-a-user", tenantId: tenantA.id }, process.env.JWT_SECRET ?? "super-secret-key");

  const app = createApp();
  const server = app.listen(0, "127.0.0.1", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(" "));
      originalWarn(...args);
    };

    try {
      const createResult = await requestJson(server, "/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "forged-tenant-project", tenantId: tenantB.id }),
      });

      assert.strictEqual(createResult.statusCode, 201, `Expected 201 from POST /projects, received ${createResult.statusCode}`);
      const created = JSON.parse(createResult.body);
      assert.strictEqual(created.tenantId, tenantA.id);
      assert.strictEqual(created.name, "forged-tenant-project");

      const listResult = await requestJson(server, `/projects?tenantId=${tenantB.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.strictEqual(listResult.statusCode, 200, `Expected 200 from GET /projects, received ${listResult.statusCode}`);
      const projects = JSON.parse(listResult.body);
      assert.ok(projects.every((project: { tenantId: string }) => project.tenantId === tenantA.id));
      assert.ok(projects.some((project: { name: string }) => project.name === "forged-tenant-project"));
      assert.ok(projects.every((project: { name: string }) => project.name !== "tenant-b-project"));

      assert.ok(warnings.some((message) => message.includes("Cross-tenant access attempt detected")));

      console.log("Tenant isolation test passed");
    } catch (error) {
      console.error("Tenant isolation test failed:", error);
      process.exitCode = 1;
    } finally {
      await prisma.project.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
      await prisma.$disconnect();
      console.warn = originalWarn;
      server.close();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
