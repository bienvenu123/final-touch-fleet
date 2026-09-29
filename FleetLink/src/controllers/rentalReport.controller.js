const rentalReportService = require("../services/rentalReport.service");

async function getRentalPerformanceReport(req, res, next) {
  try {
    const report = await rentalReportService.getRentalPerformanceMetrics(req.user.tenantId, { ...req.query, currency: req.query.currency, locale: req.query.locale });
    res.json({ report });
  } catch (error) {
    next(error);
  }
}

async function exportRentalPerformanceReport(req, res, next) {
  try {
    const format = (req.query.format || "pdf").toLowerCase();
    const report = await rentalReportService.getRentalPerformanceMetrics(req.user.tenantId, { ...req.query, currency: req.query.currency, locale: req.query.locale });

    if (format === "pdf") {
      return rentalReportService.writePdfStream(report, res, { currency: req.query.currency, locale: req.query.locale });
    }

    if (format === "xlsx") {
      return rentalReportService.writeExcelStream(report, res, { currency: req.query.currency, locale: req.query.locale });
    }

    res.status(400).json({ error: "Unsupported export format" });
  } catch (error) {
    next(error);
  }
}

async function scheduleRentalPerformanceReport(req, res, next) {
  try {
    const report = await rentalReportService.scheduleRentalReportEmail(req.user.tenantId, {
      recipient: req.body.recipient,
      format: req.body.format,
      reportType: req.body.reportType,
      currency: req.body.currency,
      locale: req.body.locale,
      start: req.body.start,
      end: req.body.end,
      scheduleAt: req.body.scheduleAt,
    });
    res.json({ scheduled: true, jobId: report });
  } catch (error) {
    next(error);
  }
}

async function getReport(req, res, next) {
  try { res.json({ report: await rentalReportService.getScheduledReport(req.user.tenantId, req.params.reportType, req.query) }); } catch (error) { next(error); }
}
async function exportReport(req, res, next) {
  try {
    const type = String(req.params.reportType || "").toUpperCase();
    const format = String(req.query.format || "pdf").toLowerCase();
    if (!rentalReportService.REPORT_TYPES[type]) return res.status(400).json({ message: "Unsupported report type" });
    const report = await rentalReportService.getScheduledReport(req.user.tenantId, type, req.query);
    const file = await rentalReportService.createScheduledReportAttachment(report, format, req.query);
    const extension = format === "xlsx" ? "xlsx" : "pdf";
    res.setHeader("Content-Type", format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${rentalReportService.REPORT_TYPES[type].filename}.${extension}"`);
    res.send(file);
  } catch (error) { next(error); }
}

async function listRecurringSchedules(req, res, next) {
  try { res.json({ schedules: await rentalReportService.listRecurringReportSchedules(req.user.tenantId) }); }
  catch (error) { next(error); }
}
async function createRecurringSchedule(req, res, next) {
  try { res.status(201).json({ schedule: await rentalReportService.saveRecurringReportSchedule(req.user.tenantId, req.body) }); }
  catch (error) { next(error); }
}
async function updateRecurringSchedule(req, res, next) {
  try { res.json({ schedule: await rentalReportService.updateRecurringReportSchedule(req.user.tenantId, req.params.scheduleId, req.body) }); }
  catch (error) { next(error); }
}
async function cancelRecurringSchedule(req, res, next) {
  try { res.json({ cancelled: true, schedule: await rentalReportService.cancelRecurringReportSchedule(req.user.tenantId, req.params.scheduleId) }); }
  catch (error) { next(error); }
}

module.exports = {
  getRentalPerformanceReport,
  exportRentalPerformanceReport,
  scheduleRentalPerformanceReport,
  getReport,
  exportReport,
  listRecurringSchedules,
  createRecurringSchedule,
  updateRecurringSchedule,
  cancelRecurringSchedule,
};
