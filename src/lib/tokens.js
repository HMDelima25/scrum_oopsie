const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { check, HttpError } = require("./http");
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
async function issueToken(db, user, purpose) {
  const token = crypto.randomBytes(32).toString("hex");
  const row = check(
    await db
      .from("user_token")
      .insert({
        user_id: user.id,
        token_hash: hash(token),
        purpose,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      })
      .select("id")
      .single(),
  );
  const url = new URL(
    purpose === "setup" ? "/set-password" : "/reset-password",
    process.env.APP_URL || "http://localhost:5000",
  );
  url.hash = new URLSearchParams({ token }).toString();
  try {
    if (
      process.env.MAIL_DELIVERY === "local" &&
      process.env.NODE_ENV !== "production"
    ) {
      const dir = path.resolve("var/outbox");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, `${row.id}.json`),
        JSON.stringify({ to: user.email, purpose, url: url.href }, null, 2),
        { mode: 0o600 },
      );
    } else if (process.env.SMTP_HOST && process.env.MAIL_FROM) {
      const mail = require("nodemailer").createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_PORT === "465",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
      await mail.sendMail({
        from: process.env.MAIL_FROM,
        to: user.email,
        subject: "HOPE, Inc. account access",
        text: `Use this one-time link within one hour: ${url.href}`,
      });
    } else
      throw new HttpError(503, "Account email delivery is not configured.");
  } catch (error) {
    await db
      .from("user_token")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);
    throw error;
  }
}
module.exports = { hash, issueToken };
