import { AsyncLocalStorage } from "async_hooks";

interface RequestContext {
  tenantId?: string;
  jwtSub?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return asyncLocalStorage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getTenantId(): string | undefined {
  return getRequestContext()?.tenantId;
}
