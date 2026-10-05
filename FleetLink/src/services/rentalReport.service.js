const prisma = require("../config/prisma");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { getBossForPublishing } = require("../config/boss");
const analyticsService = require("./analytics.service");
const efficiencyService = require("./efficiency.service");
const { randomUUID } = require("crypto");
const REPORT_QUEUE = "rental-performance-report";

const REPORT_TYPES = {
  RENTAL_PERFORMANCE: { label: "Rental Fleet Performance", filename: "rental-performance-report" },
  FUEL_EFFICIENCY: { label: "Fuel & Energy Efficiency", filename: "fuel-energy-efficiency-report" },
  MAINTENANCE_COMPLIANCE: { label: "Maintenance Compliance", filename: "maintenance-compliance-report" },
  VEHICLE_UTILIZATION: { label: "Vehicle Utilisation", filename: "vehicle-utilisation-report" },
  DEPARTMENT_ROI: { label: "Department ROI", filename: "department-roi-report" },
  TOP_REQUESTERS: { label: "Top Requesters", filename: "top-requesters-report" },
};

function parseDateFilter(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildDateRangeFilter(start, end) {
  const condition = {};
  const startDate = parseDateFilter(start);
  const endDate = parseDateFilter(end);
  if (startDate) condition.gte = startDate;
  if (endDate) condition.lte = endDate;
  return Object.keys(condition).length ? condition : undefined;
}

function moneyFormatter(currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 });
}

function numberFormatter(locale = "en-US") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
}

function reservationRevenue(reservation) {
  const addOnTotal = (Array.isArray(reservation.addOns) ? reservation.addOns : []).reduce(
    (sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 1), 0,
  );
  return Number(reservation.agreedRate) + addOnTotal;
}

async function getRentalPerformanceMetrics(tenantId, { start, end, currency, locale } = {}) {
  const dateFilter = buildDateRangeFilter(start, end);
  const reservations = await prisma.rentalReservation.findMany({
    where: {
      tenantId,
      status: "COMPLETED",
      startAt: dateFilter,
      endAt: dateFilter,
    },
    include: {
      vehicle: { select: { id: true, registration: true, make: true, model: true } },
      customer: { select: { id: true, name: true } },
      inspections: {
        where: { inspectionType: "CHECKIN" },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const totalVehicles = await prisma.vehicle.count({ where: { tenantId, retiredAt: null } });
  const totalReservations = reservations.length;

  const metricsByVehicle = reservations.reduce((acc, reservation) => {
    const key = reservation.vehicleId;
    const durationMs = Math.max(0, new Date(reservation.endAt).getTime() - new Date(reservation.startAt).getTime());
    const revenue = reservationRevenue(reservation);
    const checkinAt = reservation.inspections?.[0]?.createdAt ? new Date(reservation.inspections[0].createdAt) : null;
    const returnedOnTime = checkinAt ? checkinAt.getTime() <= new Date(reservation.endAt).getTime() : false;

    if (!acc[key]) {
      acc[key] = { vehicleId: reservation.vehicleId, registration: reservation.vehicle.registration, trips: 0, revenue: 0, durationMs: 0, onTimeReturns: 0 };
    }

    acc[key].trips += 1;
    acc[key].revenue += revenue;
    acc[key].durationMs += durationMs;
    if (returnedOnTime) {
      acc[key].onTimeReturns += 1;
    }

    return acc;
  }, {});

  const vehiclePerformance = Object.values(metricsByVehicle).map((item) => ({
    ...item,
    averageDurationHours: item.trips ? item.durationMs / (item.trips * 3600000) : 0,
    onTimeReturnRate: item.trips ? item.onTimeReturns / item.trips : 0,
    revenuePerVehicle: item.revenue,
  }));

  const totalHours = totalReservations
    ? reservations.reduce((sum, reservation) => sum + Math.max(0, new Date(reservation.endAt).getTime() - new Date(reservation.startAt).getTime()), 0) / 3600000
    : 0;
  const rangeDays = dateFilter?.gte && dateFilter?.lte
    ? Math.max(1, (new Date(dateFilter.lte).getTime() - new Date(dateFilter.gte).getTime()) / 86400000)
    : 1;
  const utilisationRate = totalVehicles ? Math.min(1, totalHours / (totalVehicles * 24 * rangeDays)) : 0;

  return {
    totalVehicles,
    totalReservations,
    totalRevenue: reservations.reduce((sum, reservation) => sum + reservationRevenue(reservation), 0),
    averageDurationHours: totalReservations ? totalHours / totalReservations : 0,
    // A reservation is on time only when its recorded check-in is on/before its due time.
    onTimeReturnRate: totalReservations ? reservations.filter((reservation) => {
      const checkin = reservation.inspections?.[0]?.createdAt;
      return checkin && new Date(checkin).getTime() <= new Date(reservation.endAt).getTime();
    }).length / totalReservations : 0,
    utilisationRate,
    vehiclePerformance,
    currency: currency || "USD",
    locale: locale || "en-US",
  };
}

function writePdfStream(report, res, { currency, locale }) {
  const formatter = moneyFormatter(currency, locale);
  const numberFmt = numberFormatter(locale);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="rental-performance-report.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).text("Rental Fleet Performance Report", { align: "center" }).moveDown();
  doc.fontSize(12).text(`Total vehicles: ${report.totalVehicles}`);
  doc.text(`Total reservations: ${report.totalReservations}`);
  doc.text(`Total revenue: ${formatter.format(report.totalRevenue)}`);
  doc.text(`Average duration: ${numberFmt.format(report.averageDurationHours)} hours`);
  doc.text(`On-time return rate: ${numberFmt.format(report.onTimeReturnRate * 100)}%`);
  doc.text(`Utilisation rate: ${numberFmt.format(report.utilisationRate * 100)}%`).moveDown();

  doc.fontSize(14).text("Vehicle Performance", { underline: true }).moveDown(0.5);
  report.vehiclePerformance.forEach((vehicle) => {
    doc.fontSize(11).text(`${vehicle.registration} — Trips: ${vehicle.trips}, Revenue: ${formatter.format(vehicle.revenue)}, Avg duration: ${numberFmt.format(vehicle.averageDurationHours)}h, On-time rate: ${numberFmt.format(vehicle.onTimeReturnRate * 100)}%`);
  });

  doc.end();
}

async function writeExcelStream(report, res, { currency, locale }) {
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rental Performance");

  sheet.columns = [
    { header: "Vehicle", key: "vehicle", width: 24 },
    { header: "Trips", key: "trips", width: 12 },
    { header: "Revenue", key: "revenue", width: 16 },
    { header: "Avg Duration (h)", key: "avgDuration", width: 16 },
    { header: "On-time Return Rate", key: "onTime", width: 18 },
  ];

  report.vehiclePerformance.forEach((vehicle) => {
    sheet.addRow({
      vehicle: vehicle.registration,
      trips: vehicle.trips,
      revenue: formatter.format(vehicle.revenue),
      avgDuration: vehicle.averageDurationHours.toFixed(2),
      onTime: `${(vehicle.onTimeReturnRate * 100).toFixed(2)}%`,
    });
  });

  sheet.addRow([]);
  sheet.addRow(["Summary"]);
  sheet.addRow(["Total vehicles", report.totalVehicles]);
  sheet.addRow(["Total reservations", report.totalReservations]);
  sheet.addRow(["Total revenue", formatter.format(report.totalRevenue)]);
  sheet.addRow(["Average duration (h)", report.averageDurationHours.toFixed(2)]);
  sheet.addRow(["On-time return rate", `${(report.onTimeReturnRate * 100).toFixed(2)}%`]);
  sheet.addRow(["Utilisation rate", `${(report.utilisationRate * 100).toFixed(2)}%`]);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="rental-performance-report.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

async function createRentalReportAttachment(report, formatType, { currency, locale }) {
  if (formatType === "pdf") {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(20).text("Rental Fleet Performance Report", { align: "center" }).moveDown();
      doc.fontSize(12).text(`Total vehicles: ${report.totalVehicles}`);
      doc.text(`Total reservations: ${report.totalReservations}`);
      doc.text(`Total revenue: ${moneyFormatter(currency, locale).format(report.totalRevenue)}`);
      doc.text(`Average duration: ${numberFormatter(locale).format(report.averageDurationHours)} hours`);
      doc.text(`On-time return rate: ${numberFormatter(locale).format(report.onTimeReturnRate * 100)}%`);
      doc.text(`Utilisation rate: ${numberFormatter(locale).format(report.utilisationRate * 100)}%`).moveDown();
      doc.end();
    });
  }

  if (formatType === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Rental Performance");
    sheet.columns = [
      { header: "Metric", key: "metric", width: 32 },
      { header: "Value", key: "value", width: 36 },
    ];
    sheet.addRow({ metric: "Total vehicles", value: report.totalVehicles });
    sheet.addRow({ metric: "Total reservations", value: report.totalReservations });
    sheet.addRow({ metric: "Total revenue", value: moneyFormatter(currency, locale).format(report.totalRevenue) });
    sheet.addRow({ metric: "Average duration (h)", value: report.averageDurationHours.toFixed(2) });
    sheet.addRow({ metric: "On-time return rate", value: `${(report.onTimeReturnRate * 100).toFixed(2)}%` });
    sheet.addRow({ metric: "Utilisation rate", value: `${(report.utilisationRate * 100).toFixed(2)}%` });
    return workbook.xlsx.writeBuffer();
  }

  throw new Error("Unsupported attachment format");
}

async function getScheduledReport(tenantId, reportType, filters = {}) {
  const type = String(reportType || "RENTAL_PERFORMANCE").toUpperCase();
  if (!REPORT_TYPES[type]) throw new Error("Unsupported report type");
  if (type === "RENTAL_PERFORMANCE") return { type, data: await getRentalPerformanceMetrics(tenantId, filters) };
  if (type === "FUEL_EFFICIENCY") return { type, data: await efficiencyService.getFuelEnergyEfficiency(tenantId, filters) };
  if (type === "MAINTENANCE_COMPLIANCE") return { type, data: await efficiencyService.getMaintenanceCompliance(tenantId, filters) };
  if (type === "VEHICLE_UTILIZATION") return { type, data: await analyticsService.getVehicleUtilization(tenantId, filters) };
  if (type === "DEPARTMENT_ROI") return { type, data: await analyticsService.getDepartmentRoi(tenantId, filters) };
  return { type, data: await analyticsService.getTopRequesters(tenantId, filters) };
}

async function createScheduledReportAttachment(report, formatType, options = {}) {
  if (report.type === "RENTAL_PERFORMANCE") return createRentalReportAttachment(report.data, formatType, options);
  const title = REPORT_TYPES[report.type].label;
  if (formatType === "pdf") {
    return new Promise((resolve, reject) => {
      const chunks = [], doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.on("data", chunk => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
      doc.fontSize(20).text(title, { align: "center" }).moveDown();
      const rows = Array.isArray(report.data) ? report.data : report.data.rows || report.data.metrics || report.data.vehicleCompliance || report.data.vehicleTrends || [report.data];
      if (!rows.length) doc.fontSize(11).text("No data for the selected period.");
      rows.forEach((row, index) => {
        doc.fontSize(11).text(`Record ${index + 1}`, { underline: true });
        Object.entries(row || {}).forEach(([key, value]) => doc.fontSize(9).text(`${key}: ${typeof value === "object" ? JSON.stringify(value) : value ?? "—"}`));
        doc.moveDown(0.5);
      });
      doc.end();
    });
  }
  if (formatType === "xlsx") {
    const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet(title.slice(0, 31));
    const rows = Array.isArray(report.data) ? report.data : report.data.rows || report.data.metrics || report.data.vehicleCompliance || report.data.vehicleTrends || [report.data];
    const columns = [...new Set(rows.flatMap(row => Object.keys(row || {})))];
    sheet.columns = columns.map(key => ({ header: key, key, width: 24 }));
    rows.forEach(row => sheet.addRow(Object.fromEntries(columns.map(key => [key, typeof row?.[key] === "object" ? JSON.stringify(row[key]) : row?.[key]]))));
    return workbook.xlsx.writeBuffer();
  }
  throw new Error("Unsupported attachment format");
}

async function getTenantManagerEmail(tenantId) {
  const manager = await prisma.user.findFirst({
    where: { tenantId, role: "FLEET_MANAGER", isActive: true },
    orderBy: { email: "asc" },
    select: { email: true },
  });
  return manager?.email || null;
}

async function scheduleRentalReportEmail(tenantId, data) {
  const boss = await getBossForPublishing();

  const recipient = data.recipient || (await getTenantManagerEmail(tenantId));
  if (!recipient) throw new Error("No email recipient available for rental report");

  const formatType = (data.format || "pdf").toLowerCase();
  const reportType = String(data.reportType || "RENTAL_PERFORMANCE").toUpperCase();
  if (!REPORT_TYPES[reportType]) throw new Error("Unsupported report type");
  const scheduleAt = new Date(data.scheduleAt || new Date());
  const currency = data.currency || "USD";
  const locale = data.locale || "en-US";

  const payload = { tenantId, recipient, formatType, reportType, currency, locale, start: data.start, end: data.end };
  const scheduledFor = scheduleAt.getTime() <= Date.now() ? new Date() : scheduleAt;
  return boss.send("rental-performance-report", payload, { startAfter: scheduledFor });
}

function getReportScheduleKey(tenantId, scheduleId) { return `report:${tenantId}:${scheduleId}`; }

async function listRecurringReportSchedules(tenantId) {
  const boss = await getBossForPublishing();
  const schedules = await boss.getSchedules(REPORT_QUEUE);
  return schedules.filter(item => item.data?.tenantId === tenantId && item.data?.scheduleId)
    .map(item => ({ id: item.data.scheduleId, reportType: item.data.reportType, recipient: item.data.recipient, format: item.data.formatType, start: item.data.start || "", end: item.data.end || "", currency: item.data.currency || "USD", locale: item.data.locale || "en-US", cron: item.cron, timezone: item.timezone || "UTC", createdAt: item.createdOn, updatedAt: item.updatedOn }));
}

async function saveRecurringReportSchedule(tenantId, data, scheduleId = randomUUID()) {
  const boss = await getBossForPublishing();
  const invalid = message => { const error = new Error(message); error.statusCode = 400; return error; };
  const reportType = String(data.reportType || "RENTAL_PERFORMANCE").toUpperCase();
  if (!REPORT_TYPES[reportType]) throw invalid("Unsupported report type");
  const recipient = String(data.recipient || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(recipient)) throw invalid("A valid recipient email is required");
  const formatType = String(data.format || "pdf").toLowerCase();
  if (!["pdf", "xlsx"].includes(formatType)) throw invalid("Format must be pdf or xlsx");
  const cron = String(data.cron || "").trim();
  if (!cron) throw invalid("A recurrence expression is required");
  const timezone = String(data.timezone || "UTC");
  const key = getReportScheduleKey(tenantId, scheduleId);
  const payload = { tenantId, scheduleId, recipient, formatType, reportType, currency: data.currency || "USD", locale: data.locale || "en-US", start: data.start || undefined, end: data.end || undefined };
  try {
    if (typeof boss.previewSchedule === "function") boss.previewSchedule(cron, { tz: timezone, count: 1 });
    await boss.schedule(REPORT_QUEUE, cron, payload, { key, tz: timezone });
  } catch (cause) {
    const error = invalid(cause.message || "The recurrence or time zone is invalid");
    error.cause = cause;
    throw error;
  }
  return (await listRecurringReportSchedules(tenantId)).find(item => item.id === scheduleId);
}

async function updateRecurringReportSchedule(tenantId, scheduleId, data) {
  const existing = (await listRecurringReportSchedules(tenantId)).find(item => item.id === scheduleId);
  if (!existing) { const error = new Error("Report schedule not found"); error.statusCode = 404; throw error; }
  return saveRecurringReportSchedule(tenantId, data, scheduleId);
}

async function cancelRecurringReportSchedule(tenantId, scheduleId) {
  const existing = (await listRecurringReportSchedules(tenantId)).find(item => item.id === scheduleId);
  if (!existing) { const error = new Error("Report schedule not found"); error.statusCode = 404; throw error; }
  const boss = await getBossForPublishing();
  await boss.unschedule(REPORT_QUEUE, getReportScheduleKey(tenantId, scheduleId));
  return { id: scheduleId };
}

module.exports = {
  getRentalPerformanceMetrics,
  writePdfStream,
  writeExcelStream,
  createRentalReportAttachment,
  createScheduledReportAttachment,
  getScheduledReport,
  scheduleRentalReportEmail,
  REPORT_TYPES,
  listRecurringReportSchedules,
  saveRecurringReportSchedule,
  updateRecurringReportSchedule,
  cancelRecurringReportSchedule,
};
