import assert from "assert";
import http from "http";
import { createApp } from "./serverApp";

function requestJson(server: http.Server, path: string): Promise<{ statusCode?: number; body: string }> {
  return new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === "string") {
      reject(new Error("Server is not listening"));
      return;
    }

    const req = http.get(
      {
        host: "127.0.0.1",
        port: address.port,
        path,
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
  });
}

async function main() {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1", async () => {
    try {
      const result = await requestJson(server, "/health");
      assert.strictEqual(result.statusCode, 200, `Expected 200 from /health, received ${result.statusCode}`);
      const payload = JSON.parse(result.body);
      assert.strictEqual(payload.status, "ok");
      console.log("Smoke test passed:", payload);
    } catch (error) {
      console.error("Smoke test failed:", error);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
