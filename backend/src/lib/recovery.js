const crypto = require("node:crypto");
const { check, HttpError, email, object, password } = require("./http");
const { hash } = require("./tokens");
const bcrypt = require("bcryptjs");
function unavailable(message) {
  const error = new HttpError(503, message);
  error.expose = true;
  return error;
}
const digest = (secret, id, code) =>
  crypto.createHmac("sha256", secret).update(`${id}:${code}`).digest("hex");
function mailer(req) {
  if (req.app.locals.recoveryMailer) return req.app.locals.recoveryMailer;
  return require("./mailer").createMailer();
}
async function requestCode(req, res) {
  const address = email(object(req.body).email),
    now = Date.now();
  const db = req.app.locals.db;
  const user = check(
    await db
      .from("users")
      .select("id,email")
      .ilike(
        "email",
        address.replace(/[%_]/g, (c) => `\\${c}`),
      )
      .eq("is_deleted", false)
      .maybeSingle(),
  );
  if (!user)
    throw new HttpError(
      404,
      "This email does not exist. Check the spelling and try again.",
      "email",
    );
  const send = mailer(req);
  if (req.session.recoverySentAt > now - 60000)
    throw new HttpError(
      429,
      "Please wait one minute before requesting another code.",
    );
  const id = crypto.randomUUID(),
    code = crypto.randomInt(1000000).toString().padStart(6, "0");
  delete req.session.recoveryGrant;
  req.session.recoveryId = id;
  req.session.recoverySentAt = now;
  if (user) {
    const issued = check(
      await db.rpc("hope_issue_recovery", {
        p_user: user.id,
        p_id: id,
        p_code_hash: digest(req.app.locals.recoverySecret, id, code),
        p_token_hash: hash(crypto.randomBytes(32).toString("hex")),
      }),
    );
    if (!issued)
      throw new HttpError(
        429,
        "Please wait one minute before requesting another code.",
      );
    try {
      await send({
        to: user.email,
        subject: "Your HOPE password reset code",
        text: `Your HOPE password reset code is ${code}.\n\nEnter these six digits in HOPE within 10 minutes. This code can only be used once. If you did not request it, ignore this email.`,
      });
    } catch {
      await db
        .from("user_token")
        .update({ used_at: new Date().toISOString() })
        .eq("id", id);
      throw unavailable("We could not send the code. Please try again later.");
    }
  }
  res.json({
    status: "success",
    message:
      "A six-digit verification code has been sent to your account email.",
    retryAfter: 60,
  });
}
async function verifyCode(req, res) {
  const code = object(req.body).code;
  if (typeof code !== "string" || !/^\d{6}$/.test(code))
    throw new HttpError(400, "Enter the six-digit code from your email.");
  const id = req.session.recoveryId;
  if (!id) throw new HttpError(400, "Request a new code first.");
  const grant = crypto.randomBytes(32).toString("hex");
  const valid = check(
    await req.app.locals.db.rpc("hope_verify_recovery", {
      p_id: id,
      p_code_hash: digest(req.app.locals.recoverySecret, id, code),
      p_grant_hash: hash(grant),
    }),
  );
  if (!valid)
    throw new HttpError(
      400,
      "The code is incorrect or expired. After five attempts, request a new code.",
    );
  req.session.recoveryGrant = grant;
  delete req.session.recoveryId;
  res.json({
    status: "success",
    message: "Code confirmed. Choose your new password.",
  });
}
async function changePassword(req, res) {
  const b = object(req.body),
    next = password(b.newPassword);
  if (next !== b.confirmPassword)
    throw new HttpError(400, "The passwords do not match.");
  if (!req.session.recoveryGrant)
    throw new HttpError(
      400,
      "Confirm your email code before changing your password.",
    );
  check(
    await req.app.locals.db.rpc("hope_consume_token", {
      p_hash: hash(req.session.recoveryGrant),
      p_password_hash: await bcrypt.hash(next, 12),
    }),
  );
  delete req.session.recoveryGrant;
  res.json({
    status: "success",
    message: "Password changed. Sign in with your new password.",
  });
}
module.exports = { requestCode, verifyCode, changePassword, digest };
