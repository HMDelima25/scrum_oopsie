const { check } = require("./http");
module.exports = async function recordLogin(req, user, method) {
  check(
    await req.app.locals.db
      .from("login_activity")
      .insert({ user_id: user.id, name: user.name, role: user.role, method }),
  );
};
