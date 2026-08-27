import "dotenv/config";
import express from "express";
import prisma from "./lib/prisma";
import { enforceTenantScope, AuthenticatedRequest } from "./middleware/enforceTenantScope";

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(enforceTenantScope);

  app.get("/projects", async (_req, res) => {
    const projects = await prisma.project.findMany();
    res.json(projects);
  });

  const createProjectHandler: express.RequestHandler = async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { name } = authReq.body;
    if (!name) {
      return res.status(400).json({ error: "Missing project name" });
    }

    const project = await prisma.project.create({
      data: { name } as any,
    });

    res.status(201).json(project);
  };

  app.post("/projects", createProjectHandler);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

export function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT ?? 4000);
  return app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

if (require.main === module) {
  startServer();
}
