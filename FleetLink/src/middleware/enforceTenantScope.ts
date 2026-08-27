import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { runWithRequestContext } from "../lib/asyncLocal";

const JWT_SECRET = process.env.JWT_SECRET ?? "super-secret-key";

export interface AuthenticatedRequest extends Request {
  tenantId: string;
  jwtSub: string;
}

export function enforceTenantScope(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice("Bearer ".length);

  let payload: any;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const tenantId = payload?.tenantId;
  const jwtSub = payload?.sub;

  if (!tenantId || typeof tenantId !== "string") {
    return res.status(401).json({ error: "Token missing tenantId" });
  }

  if (!jwtSub || typeof jwtSub !== "string") {
    return res.status(401).json({ error: "Token missing sub" });
  }

  if (req.body && "tenantId" in req.body && req.body.tenantId !== tenantId) {
    console.warn(
      "Cross-tenant access attempt detected: request body tenantId differs from JWT tenantId",
      { jwtTenantId: tenantId, bodyTenantId: req.body.tenantId, path: req.path, method: req.method }
    );
  }

  const context = { tenantId, jwtSub };
  return runWithRequestContext(context, () => {
    (req as AuthenticatedRequest).tenantId = tenantId;
    (req as AuthenticatedRequest).jwtSub = jwtSub;
    next();
  });
}
