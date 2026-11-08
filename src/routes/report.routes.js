const router = require("express").Router();
const { requireUser } = require("../middleware/auth.middleware");
const { allowed } = require("../lib/permissions");
const { wrap, check, HttpError } = require("../lib/http");
const reports = {
  "top-customers": "topCustomers",
  "product-master-list": "productMaster",
  "top-products": "topProducts",
  "active-employees": "activeEmployees",
  "all-employees": "allEmployees",
  "employee-job-history": "empJobHistory",
  "top-sales": "topSales",
};
router.use(requireUser);
router.get(
  "/:report",
  wrap(async (req, res) => {
    const report = reports[req.params.report];
    if (!report) throw new HttpError(404, "Report not found.");
    if (!allowed(req.user, `reports.${report}`))
      throw new HttpError(403, "Report access denied.");
    const top = Math.min(100, Math.max(1, parseInt(req.query.top) || 10));
    const params = {
      p_report: report,
      p_from: req.query.from || null,
      p_to: req.query.to || null,
      p_top: top,
      p_employee: req.query.employee || null,
    };
    for (const v of [params.p_from, params.p_to])
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v))
        throw new HttpError(400, "Dates must use YYYY-MM-DD.");
    if (params.p_from && params.p_to && params.p_from > params.p_to)
      throw new HttpError(400, "Start date must precede end date.");
    const data = check(await req.app.locals.db.rpc("hope_report", params));
    res.json({ status: "success", access:{role:req.user.role,rights:req.user.rights}, data });
  }),
);
module.exports = router;
