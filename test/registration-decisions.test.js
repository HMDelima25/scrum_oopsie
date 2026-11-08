const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { createDatabase } = require("./helpers/database");
const createApp = require("../src/app");
test("Registration review decisions are atomic, authorized and filterable", async (t) => {
  const db = await createDatabase(),
    hash = await bcrypt.hash("Fixture-auth-2026!", 4),
    ids = {};
  for (const [username, name, role, status] of [
    ["root", "Review Superadmin", "superadmin", "approved"],
    ["manager", "Review Admin", "admin", "approved"],
    ["approve-me", "Approve Me", "user", "pending"],
    ["reject-me", "Reject Me", "user", "pending"],
    ["member", "Review User", "user", "approved"],
  ])
    ids[username] = (
      await db.pg.query(
        "INSERT INTO users(username,name,role,status,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [username, name, role, status, hash],
      )
    ).rows[0].id;
  const server = createApp({
    db,
    sessionSecret: "registration-review-test-secret-".repeat(2),
    origins: [],
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await db.pg.close();
  });
  const base = "http://127.0.0.1:" + server.address().port,
    cookies = {};
  async function req(who, path, body, version) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        cookie: cookies[who] || "",
        ...(version ? { "if-match": JSON.stringify(version) } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.headers.get("set-cookie"))
      cookies[who] = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, body: await r.json() };
  }
  async function row(username) {
    return (
      await db.pg.query("SELECT * FROM users WHERE id=$1", [ids[username]])
    ).rows[0];
  }
  for (const who of ["root", "manager", "member"])
    assert.equal(
      (
        await req(who, "/api/auth/login", {
          identifier: who,
          password: "Fixture-auth-2026!",
        })
      ).status,
      200,
    );
  await t.test(
    "no decision remains pending and lower roles cannot review",
    async () => {
      const record = await row("approve-me");
      for (const [who, expected] of [
        ["anonymous", 401],
        ["manager", 403],
        ["member", 403],
      ])
        assert.equal(
          (
            await req(
              who,
              "/api/admin/users/" + record.id + "/review",
              { decision: "approved" },
              record.updated_at,
            )
          ).status,
          expected,
        );
      assert.equal((await row("approve-me")).status, "pending");
    },
  );
  await t.test(
    "approval preserves role and writes the acting full name",
    async () => {
      const r = await row("approve-me"),
        result = await req(
          "root",
          "/api/admin/users/" + r.id + "/review",
          { decision: "approved" },
          r.updated_at,
        );
      assert.equal(result.status, 200);
      assert.equal(result.body.data.status, "approved");
      assert.equal(result.body.data.role, "user");
      assert.match(result.body.data.stamp, /Review Superadmin/);
      assert.equal(result.body.data.password_hash, undefined);
    },
  );
  await t.test(
    "disapproval is distinct from blocking and prevents login",
    async () => {
      const r = await row("reject-me");
      assert.equal(
        (
          await req(
            "root",
            "/api/admin/users/" + r.id + "/review",
            { decision: "disapproved" },
            r.updated_at,
          )
        ).status,
        200,
      );
      assert.equal((await row("reject-me")).status, "disapproved");
      const login = await req("rejected", "/api/auth/login", {
        identifier: "reject-me",
        password: "Fixture-auth-2026!",
      });
      assert.equal(login.status, 403);
      assert.match(login.body.message, /disapproved/);
    },
  );
  await t.test(
    "reviewed and stale accounts cannot be overwritten",
    async () => {
      const r = await row("approve-me");
      assert.equal(
        (
          await req(
            "root",
            "/api/admin/users/" + r.id + "/review",
            { decision: "disapproved" },
            r.updated_at,
          )
        ).status,
        409,
      );
      const stale = (
        await db.pg.query(
          "INSERT INTO users(username,name,status) VALUES('stale-review','Stale','pending') RETURNING *",
        )
      ).rows[0];
      await db.pg.query("UPDATE users SET name=$1 WHERE id=$2", [
        "Changed elsewhere",
        stale.id,
      ]);
      assert.equal(
        (
          await req(
            "root",
            "/api/admin/users/" + stale.id + "/review",
            { decision: "approved" },
            stale.updated_at,
          )
        ).status,
        409,
      );
      assert.equal(
        (await db.pg.query("SELECT status FROM users WHERE id=$1", [stale.id]))
          .rows[0].status,
        "pending",
      );
    },
  );
  await t.test(
    "missing version and invalid decision are rejected",
    async () => {
      assert.equal(
        (
          await req("root", "/api/admin/users/" + ids.member + "/review", {
            decision: "approved",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await req(
            "root",
            "/api/admin/users/" + ids.member + "/review",
            { decision: "blocked" },
            (await row("member")).updated_at,
          )
        ).status,
        400,
      );
    },
  );
  await t.test(
    "Pending, Approved and Disapproved filters use persisted states",
    async () => {
      for (const status of ["pending", "approved", "disapproved"]) {
        const r = await req(
          "root",
          "/api/admin/users?status=all&f_status=" + status,
        );
        assert.equal(r.status, 200);
        assert.ok(r.body.data.length);
        assert.ok(r.body.data.every((u) => u.status === status));
      }
    },
  );
  await t.test("anonymous database role cannot call review RPC", async () => {
    await db.pg.exec("SET ROLE anon");
    try {
      await assert.rejects(
        db.pg.query("SELECT hope_review_registration($1,$2,$3,$4)", [
          ids.root,
          ids.member,
          "approved",
          new Date().toISOString(),
        ]),
        /permission denied/,
      );
    } finally {
      await db.pg.exec("RESET ROLE");
    }
  });
});
