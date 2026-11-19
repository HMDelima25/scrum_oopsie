const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createMailer } = require("../backend/src/lib/mailer");
const env = { MAIL_DELIVERY: "gmail-api", GMAIL_CLIENT_ID: "synthetic-client", GMAIL_CLIENT_SECRET: "synthetic-secret", GMAIL_REFRESH_TOKEN: "synthetic-refresh", MAIL_FROM: "sender@example.test" };

test("Gmail HTTPS transport refreshes authorization and sends a properly encoded code email", async () => {
  const calls = [];
  const send = createMailer(env, async (url, options) => {
    calls.push([url, options]);
    return new Response(JSON.stringify(calls.length === 1 ? { access_token: "synthetic-access" } : { id: "sent-id" }));
  });
  assert.deepEqual(await send({ to: "recipient@example.test", subject: "Recovery code", text: "Your code is 012345." }), { messageId: "sent-id" });
  assert.equal(calls[0][0], "https://oauth2.googleapis.com/token");
  assert.equal(calls[0][1].body.get("grant_type"), "refresh_token");
  assert.equal(calls[1][0], "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  assert.equal(calls[1][1].headers.authorization, "Bearer synthetic-access");
  const raw = JSON.parse(calls[1][1].body).raw;
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  const message = Buffer.from(raw, "base64url").toString();
  assert.match(message, /From: sender@example.test/);
  assert.match(message, /To: recipient@example.test/);
  assert.match(message, /012345/);
  assert.ok(!message.includes("synthetic-refresh"));
});
test("Gmail provider and authorization failures never expose tokens or claim delivery", async () => {
  for (const failure of [0, 1]) {
    let count = 0;
    const send = createMailer(env, async () => {
      const fail = count++ === failure;
      return new Response(JSON.stringify(fail ? { error: "private-token-detail" } : { access_token: "synthetic-access" }), { status: fail ? 403 : 200 });
    });
    await assert.rejects(send({ to: "recipient@example.test", text: "012345" }), error => error.status === 503 && !error.message.includes("private-token-detail"));
    assert.equal(count, failure + 1);
  }
});
test("missing Gmail sender authorization fails before any network request", () => {
  assert.throws(() => createMailer({ ...env, GMAIL_REFRESH_TOKEN: "" }), error => error.status === 503);
});
test("Render blocked SMTP ports fail promptly while Gmail HTTPS transport remains available", () => {
  for (const port of ["25", "465", "587"]) {
    assert.throws(() => createMailer({ RENDER: "true", SMTP_HOST: "smtp.example.test", SMTP_PORT: port, SMTP_USER: "test", SMTP_PASSWORD: "synthetic", MAIL_FROM: "sender@example.test" }), error => error.status === 503);
  }
  assert.equal(typeof createMailer({ ...env, RENDER: "true" }), "function");
});
