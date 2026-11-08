const bcrypt = require("bcryptjs");
const {
  check,
  HttpError,
  text,
  email,
  password,
  object,
} = require("../lib/http");
const { hash } = require("../lib/tokens");
const safe = "id,username,email,name,role,status,rights,created_at";
function username(value) {
  const u = text(value, "Username", 32).toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(u))
    throw new HttpError(
      400,
      "Use a username of 3�32 letters, numbers, dots, underscores or hyphens, starting with a letter.",
    );
  return u;
}
async function registerUser(req, res) {
  const b = object(req.body);
  const name = text(
    b.name || [b.firstName, b.lastName].filter(Boolean).join(" "),
    "Name",
  );
  const row = { name, email: email(b.email), role: "user", status: "pending" };
  if (b.username !== undefined) row.username = username(b.username);
  if (b.password !== undefined)
    row.password_hash = await bcrypt.hash(password(b.password), 12);
  const data = check(
    await req.app.locals.db.from("users").insert(row).select(safe).single(),
  );
  res.status(201).json({
    status: "success",
    message: "Your account is awaiting Superadmin approval.",
    data,
  });
}
async function loginUser(req, res) {
  const b = object(req.body);
  const identifier = text(
    b.identifier || b.email || b.username,
    "Email or username",
    254,
  ).toLowerCase();
  const field = identifier.includes("@") ? "email" : "username";
  let address;
  try {
    address = field === "email" ? email(identifier) : username(identifier);
  } catch (error) {
    error.field = "identifier";
    throw error;
  }
  if (
    typeof b.password !== "string" ||
    !b.password ||
    Buffer.byteLength(b.password) > 72
  )
    throw new HttpError(400, "Enter your password.", "password");
  const user = check(
    await req.app.locals.db
      .from("users")
      .select("*")
      .eq(field, address)
      .maybeSingle(),
  );
  if (!user || user.is_deleted)
    throw new HttpError(
      401,
      field === "email"
        ? "This email does not exist."
        : "This username does not exist.",
      "identifier",
    );
  if (
    !user.password_hash ||
    !(await bcrypt.compare(b.password, user.password_hash))
  )
    throw new HttpError(401, "The password is incorrect.", "password");
  if (user.status !== "approved")
    throw new HttpError(
      403,
      user.status === "pending"
        ? "Your account is awaiting approval."
        : "Your account is blocked.",
      "identifier",
    );
  await new Promise((resolve, reject) =>
    req.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
  req.session.userId = user.id;
  req.session.authVersion = user.auth_version;
  await new Promise((resolve, reject) =>
    req.session.save((e) => (e ? reject(e) : resolve())),
  );
  res.json({
    status: "success",
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      rights: user.rights,
    },
  });
}
async function logoutUser(req, res) {
  await new Promise((resolve, reject) =>
    req.session.destroy((e) => (e ? reject(e) : resolve())),
  );
  res.clearCookie("hope.sid");
  res.json({ status: "success" });
}
async function resetPassword(req, res) {
  const b = object(req.body);
  const token = text(b.token, "Token", 256);
  const password_hash = await bcrypt.hash(password(b.newPassword), 12);
  check(
    await req.app.locals.db.rpc("hope_consume_token", {
      p_hash: hash(token),
      p_password_hash: password_hash,
    }),
  );
  res.json({
    status: "success",
    message: "Password updated. Sign in to continue.",
  });
}
function getMe(req, res) {
  const { id, username, email, name, role, status, rights } = req.user;
  res.json({
    status: "success",
    data: { id, username, email, name, role, status, rights },
  });
}
module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  resetPassword,
  getMe,
};
