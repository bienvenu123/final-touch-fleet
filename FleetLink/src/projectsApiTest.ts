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
  const tenantName = `tenant-${Date.now()}`;
  const tenant = await prisma.tenant.create({
    data: { name: tenantName, sector: "test", package: "basic", billingStatus: "active" },
    select: { id: true },
  });

  const token = jwt.sign({ sub: "test-user", tenantId: tenant.id }, process.env.JWT_SECRET ?? "super-secret-key");
  const app = createApp();
  const server = app.listen(0, "127.0.0.1", async () => {
    try {
      const createResult = await requestJson(server, "/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "integration-project" }),
      });

      assert.strictEqual(createResult.statusCode, 201, `Expected 201 from POST /projects, received ${createResult.statusCode}`);

      const createdProject = JSON.parse(createResult.body);
      assert.strictEqual(createdProject.name, "integration-project");
      assert.strictEqual(createdProject.tenantId, tenant.id);

      const listResult = await requestJson(server, "/projects", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.strictEqual(listResult.statusCode, 200, `Expected 200 from GET /projects, received ${listResult.statusCode}`);
      const projects = JSON.parse(listResult.body);
      assert.ok(projects.some((project: { id: string }) => project.id === createdProject.id));

      console.log("Projects API test passed:", createdProject);
    } catch (error) {
      console.error("Projects API test failed:", error);
      process.exitCode = 1;
    } finally {
      await prisma.project.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.$disconnect();
      server.close();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
