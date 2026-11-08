const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { createDatabase } = require("./helpers/database");
const createApp = require("../src/app");
test("Six-digit email recovery lifecycle", async (t) => {
  const db = await createDatabase(),
    messages = [];
  const user = (
    await db.pg.query(
      `INSERT INTO users(username,email,name,role,status,password_hash) VALUES('recover','recover@example.test','Recovery','user','pending',$1) RETURNING id`,
      [await bcrypt.hash("Previous-password", 4)],
    )
  ).rows[0];
  const app = createApp({
    db,
    sessionSecret: "private-recovery-test-secret-".repeat(2),
    origins: [],
    recoveryMailer: async (mail) => messages.push(mail),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await db.pg.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  let cookie = "";
  async function post(route, body) {
    const r = await fetch(base + "/api/auth/" + route, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, body: await r.json() };
  }
  const code = () => messages.at(-1).text.match(/is (\d{6})/)[1];
  await t.test("cannot change password before confirming code", async () =>
    assert.equal(
      (
        await post("change-recovered-password", {
          newPassword: "New-password-123",
          confirmPassword: "New-password-123",
        })
      ).status,
      400,
    ),
  );
  await t.test(
    "matches existing email case insensitively and sends digits without links",
    async () => {
      const r = await post("forgot-password", {
        email: "RECOVER@example.test",
      });
      assert.equal(r.status, 200);
      assert.equal(messages.length, 1);
      assert.match(code(), /^\d{6}$/);
      assert.ok(!JSON.stringify(r.body).includes(code()));
      assert.ok(!messages[0].text.includes("http"));
      assert.equal(messages[0].to, "recover@example.test");
    },
  );
  await t.test(
    "resending is throttled and incorrect codes are rejected",
    async () => {
      assert.equal(
        (await post("forgot-password", { email: "recover@example.test" }))
          .status,
        429,
      );
      assert.equal(
        (await post("verify-recovery-code", { code: "abc123" })).status,
        400,
      );
      assert.equal(
        (
          await post("verify-recovery-code", {
            code: code() === "000000" ? "111111" : "000000",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "correct code unlocks password prompt exactly once",
    async () => {
      assert.equal(
        (await post("verify-recovery-code", { code: code() })).status,
        200,
      );
      assert.equal(
        (await post("verify-recovery-code", { code: code() })).status,
        400,
      );
      assert.equal(
        (
          await post("change-recovered-password", {
            newPassword: "New-password-123",
            confirmPassword: "Mismatch-password",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await post("change-recovered-password", {
            newPassword: "New-password-123",
            confirmPassword: "New-password-123",
          })
        ).status,
        200,
      );
      const row = (
        await db.pg.query("SELECT * FROM users WHERE id=$1", [user.id])
      ).rows[0];
      assert.ok(await bcrypt.compare("New-password-123", row.password_hash));
      assert.equal(row.status, "pending");
      assert.equal(
        (
          await post("change-recovered-password", {
            newPassword: "Another-password-1",
            confirmPassword: "Another-password-1",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "unknown and misspelled emails are rejected before sending a code",
    async () => {
      cookie = "";
      const r = await post("forgot-password", {
        email: "missing@example.test",
      });
      assert.equal(r.status, 404);
      assert.equal(r.body.field, "email");
      assert.match(r.body.message, /email does not exist/);
      assert.equal(messages.length, 1);
      const typo = await post("forgot-password", {
        email: "recvoer@example.test",
      });
      assert.equal(typo.status, 404);
      assert.equal(messages.length, 1);
      assert.equal(
        (await post("verify-recovery-code", { code: "123456" })).status,
        400,
      );
    },
  );
  await t.test(
    "database locks out after five bad codes, expires codes and invalidates old codes on resend",
    async () => {
      const { digest } = require("../src/lib/recovery"),
        crypto = require("crypto"),
        { hash } = require("../src/lib/tokens");
      async function issue() {
        await db.pg.query(
          `UPDATE user_token SET created_at=now()-interval '2 minutes' WHERE user_id=$1`,
          [user.id],
        );
        const id = crypto.randomUUID();
        assert.equal(
          (
            await db.rpc("hope_issue_recovery", {
              p_user: user.id,
              p_id: id,
              p_code_hash: digest(app.locals.recoverySecret, id, "001234"),
              p_token_hash: hash(crypto.randomUUID()),
            })
          ).data,
          true,
        );
        return id;
      }
      async function verify(id, c) {
        return (
          await db.rpc("hope_verify_recovery", {
            p_id: id,
            p_code_hash: digest(app.locals.recoverySecret, id, c),
            p_grant_hash: hash(crypto.randomUUID()),
          })
        ).data;
      }
      let id = await issue();
      for (let i = 0; i < 5; i++)
        assert.equal(await verify(id, "654321"), false);
      assert.equal(await verify(id, "001234"), false);
      id = await issue();
      await db.pg.query(
        `UPDATE user_token SET expires_at=now()-interval '1 second' WHERE id=$1`,
        [id],
      );
      assert.equal(await verify(id, "001234"), false);
      id = await issue();
      const newer = await issue();
      assert.equal(await verify(id, "001234"), false);
      assert.equal(await verify(newer, "001234"), true);
      assert.equal(await verify(newer, "001234"), false);
    },
  );
  await t.test(
    "mail failures invalidate code and never claim delivery",
    async () => {
      cookie = "";
      await db.pg.query(
        `UPDATE user_token SET created_at=now()-interval '2 minutes' WHERE user_id=$1`,
        [user.id],
      );
      app.locals.recoveryMailer = async () => {
        throw new Error("private transport error");
      };
      const r = await post("forgot-password", {
        email: "recover@example.test",
      });
      assert.equal(r.status, 503);
      assert.match(r.body.message, /could not send the code/);
      assert.ok(!JSON.stringify(r.body).includes("private transport error"));
      const row = (
        await db.pg.query(
          "SELECT used_at FROM user_token WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
          [user.id],
        )
      ).rows[0];
      assert.ok(row.used_at);
    },
  );
});
