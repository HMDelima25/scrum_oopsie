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
const roleController = require("../controllers/roles.controller");
router.get(
  "/activities",
  wrap(async (req, res) => {
    let q = req.app.locals.db
      .from("login_activity")
      .select("id,name,role,logged_in_at", { count: "exact" });
    if (req.user.role === "admin") q = q.eq("role", "user");
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 200)),
      offset = Math.max(0, parseInt(req.query.offset) || 0);
    const result = await q
      .order("logged_in_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);
    const rows = check(result).map(({ id, name, role, logged_in_at }) => ({
      logged_in_at,
      name,
      role,
      login_date: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(logged_in_at)),
      login_time: new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(new Date(logged_in_at)),
    }));
    res.json({
      status: "success",
      data: rows,
      count: result.count,
      limit,
      offset,
    });
  }),
);
router.get(
  "/system-roles",
  wrap(async (req, res) => {
    let q = req.app.locals.db
      .from("users")
      .select("name,username,role,status")
      .eq("is_deleted", false);
    if (req.user.role === "admin") q = q.eq("role", "user");
    const people = check(await q);
    const roles =
      req.user.role === "superadmin"
        ? ["superadmin", "admin", "user"]
        : ["user"];
    res.json({
      status: "success",
      data: roles.map((role) => ({
        id: "system:" + role,
        system_role: role,
        name:
          role === "superadmin"
            ? "Superadmin"
            : role === "admin"
              ? "Admin"
              : "User",
        description: "Built-in system role",
        status: "active",
        members: people.filter(
          (p) => p.role === role && p.status === "approved",
        ).length,
        permission_count:
          role === "superadmin" ? Object.keys(catalogue).length : "Per account",
        members_details: people.filter((p) => p.role === role),
      })),
    });
  }),
);
router.get("/roles", wrap(roleController.list));
router.post("/roles", wrap(roleController.save));
router.get("/roles/:id", wrap(roleController.get));
router.put("/roles/:id", wrap(roleController.save));
router.put("/users/:id/permission-role", wrap(roleController.assign));
router.get("/users", wrap(c.getUsersList));
router.post(
  "/users/:id/review",
  requireSuperadmin,
  wrap(async (req, res) => {
    const body = object(req.body);
    if (
      Object.keys(body).some((key) => key !== "decision") ||
      !["approved", "disapproved"].includes(body.decision)
    )
      throw new HttpError(400, "Choose Approved or Disapproved.");
    let expected;
    try {
      expected = JSON.parse(req.get("if-match") || "null");
    } catch {
      throw new HttpError(400, "Invalid account version.");
    }
    if (typeof expected !== "string" || !Number.isFinite(Date.parse(expected)))
      throw new HttpError(400, "Reload the account before reviewing it.");
    const data = check(
      await req.app.locals.db.rpc("hope_review_registration", {
        p_actor: req.user.id,
        p_user: req.params.id,
        p_decision: body.decision,
        p_expected: expected,
      }),
    );
    res.json({ status: "success", data });
  }),
);
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
