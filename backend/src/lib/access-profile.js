const { check } = require("./http");

async function accessProfile(req, user) {
  let permissionRole = null;
  if (user.permission_role_id) {
    permissionRole = check(
      await req.app.locals.db
        .from("permission_role")
        .select("id,name,description,status")
        .eq("id", user.permission_role_id)
        .maybeSingle(),
    );
  }
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    rights: user.rights || {},
    permission_role_id: user.permission_role_id || null,
    permission_role: permissionRole
      ? {
          id: permissionRole.id,
          name: permissionRole.name,
          description: permissionRole.description,
          status: permissionRole.status,
        }
      : null,
    workspace:
      user.role === "superadmin" || user.role === "admin"
        ? "admin"
        : Object.values(user.rights || {}).some((allowed) => allowed === true)
          ? "staff"
          : "user",
  };
}

module.exports = accessProfile;
