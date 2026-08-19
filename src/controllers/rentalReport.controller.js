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

module.exports = {
  getRentalPerformanceReport,
  exportRentalPerformanceReport,
  scheduleRentalPerformanceReport,
};
