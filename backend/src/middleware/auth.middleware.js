const { wrap, check, HttpError } = require("../lib/http");
const { allowed } = require("../lib/permissions");
const requireUser = wrap(async (req, res, next) => {
  if (!req.session.userId) throw new HttpError(401, "Please sign in.");
  const user = check(
    await req.app.locals.db
      .from("users")
      .select("id,username,email,name,role,status,rights,auth_version,is_deleted")
      .eq("id", req.session.userId)
      .maybeSingle(),
  );
  if (
    !user ||
    user.status !== "approved" ||
    user.is_deleted ||
    user.auth_version !== req.session.authVersion
  ) {
    req.session.destroy(() => {});
    throw new HttpError(401, "Your session has ended. Please sign in again.");
  }
  req.user = user;
  next();
});
function requireAdmin(req, res, next) {
  if (!["admin", "superadmin"].includes(req.user?.role))
    return next(new HttpError(403, "Administrator access required."));
  next();
}
function requireSuperadmin(req, res, next) {
  if (req.user?.role !== "superadmin")
    return next(new HttpError(403, "Superadmin access required."));
  next();
}
function checkPermission(module, action = "view") {
  return (req, res, next) =>
    allowed(req.user, `${module}.${action}`)
      ? next()
      : next(new HttpError(403, "This action is not permitted."));
}
module.exports = {
  requireUser,
  requireAdmin,
  requireSuperadmin,
  checkPermission,
};
