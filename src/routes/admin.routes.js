const router = require("express").Router();
const c = require("../controllers/admin.controller");
const {
  requireUser,
  requireAdmin,
  requireSuperadmin,
} = require("../middleware/auth.middleware");
const { wrap, check, object, HttpError } = require("../lib/http");
const { catalogue } = require("../lib/permissions");
router.use(requireUser, requireAdmin);
router.get("/rights-catalogue", (req, res) =>
  res.json({ status: "success", data: catalogue }),
);
const roleController=require("../controllers/roles.controller");
router.get("/roles",wrap(roleController.list));
router.post("/roles",wrap(roleController.save));
router.get("/roles/:id",wrap(roleController.get));
router.put("/roles/:id",wrap(roleController.save));
router.put("/users/:id/permission-role",wrap(roleController.assign));
router.get("/users", wrap(c.getUsersList));
router.post("/users", wrap(c.addUser));
router.get("/users/:id/rights", wrap(c.getUserRights));
router.put("/users/:id/rights", wrap(c.updateUserRights));
router.put("/users/:id", wrap(c.updateUser));
router.patch("/users/:id/status", wrap(c.toggleUserStatus));
router.post("/users/:id/invite", wrap(c.inviteUser));
router.get(
  "/audit-log",
  requireSuperadmin,
  wrap(async (req, res) =>
    res.json({
      status: "success",
      data: check(
        await req.app.locals.db
          .from("audit_log")
          .select("*")
          .order("audit_id", { ascending: false })
          .limit(200),
      ),
    }),
  ),
);
router.get(
  "/settings",
  requireSuperadmin,
  wrap(async (req, res) =>
    res.json({
      status: "success",
      data: check(await req.app.locals.db.from("app_setting").select("*")),
    }),
  ),
);
router.put(
  "/settings/:key",
  requireSuperadmin,
  wrap(async (req, res) => {
    if (
      !["company_name", "company_address", "report_footer"].includes(
        req.params.key,
      )
    )
      throw new HttpError(400, "Unsupported setting.");
    const b = object(req.body);
    if (typeof b.value !== "string" || b.value.length > 1000)
      throw new HttpError(
        400,
        "Setting must be text, maximum 1000 characters.",
      );
    res.json({
      status: "success",
      data: check(
        await req.app.locals.db
          .from("app_setting")
          .upsert({
            key: req.params.key,
            value: b.value,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single(),
      ),
    });
  }),
);
module.exports = router;
