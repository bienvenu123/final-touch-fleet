const startedAt = Date.now();
const totals = { requests: 0, errors: 0, durationMs: 0, byStatus: {} };

function monitoring(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    totals.requests += 1; totals.durationMs += durationMs;
    totals.byStatus[res.statusCode] = (totals.byStatus[res.statusCode] || 0) + 1;
    if (res.statusCode >= 500) totals.errors += 1;
  });
  next();
}
function snapshot() { return { uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), requests: totals.requests, errors: totals.errors, averageDurationMs: totals.requests ? Number((totals.durationMs / totals.requests).toFixed(2)) : 0, statusCodes: totals.byStatus }; }
module.exports = { monitoring, snapshot };
