const nodemailer = require("nodemailer");
const { HttpError } = require("./http");

function unavailable(message = "Email delivery is not configured yet. Please contact your administrator.") {
  const error = new HttpError(503, message);
  error.expose = true;
  return error;
}

function createMailer(env = process.env, request = globalThis.fetch) {
  if (env.MAIL_DELIVERY === "gmail-api") {
    const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, MAIL_FROM } = env;
    if (![GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, MAIL_FROM].every(Boolean)) {
      throw unavailable();
    }
    const mime = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
    return async message => {
      try {
        const tokenResponse = await request("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GMAIL_CLIENT_ID, client_secret: GMAIL_CLIENT_SECRET,
            refresh_token: GMAIL_REFRESH_TOKEN, grant_type: "refresh_token",
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!tokenResponse.ok) throw new Error("Email authorization failed");
        const token = await tokenResponse.json();
        if (!token.access_token) throw new Error("Missing email authorization");
        const generated = await mime.sendMail({ ...message, from: MAIL_FROM });
        const sent = await request("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" },
          body: JSON.stringify({ raw: generated.message.toString("base64url") }),
          signal: AbortSignal.timeout(10000),
        });
        if (!sent.ok) throw new Error("Email delivery failed");
        const result = await sent.json();
        if (!result.id) throw new Error("Email delivery was not confirmed");
        return { messageId: result.id };
      } catch {
        // Provider responses can contain credentials or message contents.
        throw unavailable("Email could not be sent. Please try again later.");
      }
    };
  }
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.MAIL_FROM) throw unavailable();
  if (env.RENDER === "true" && [25, 465, 587].includes(Number(env.SMTP_PORT || 587))) throw unavailable();
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_PORT === "465",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10000, socketTimeout: 15000,
  });
  return message => transport.sendMail({ ...message, from: env.MAIL_FROM });
}
module.exports = { createMailer };
