const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { createDatabase } = require("./helpers/database");
const createApp = require("../backend/src/app");
test("Login activities, system roles and full-name audit actors", async (t) => {
  const db = await createDatabase(),
    hash = await bcrypt.hash("Existing-test-123!", 4),
    ids = {};
  for (const [username, name, role] of [
    ["root", "Natalia Team Root", "superadmin"],
    ["manager", "Manager Person", "admin"],
    ["member", "Member Person", "user"],
  ])
    ids[username] = (
      await db.pg.query(
        "INSERT INTO users(username,name,role,status,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [username, name, role, "approved", hash],
      )
    ).rows[0].id;
  const app = createApp({
      db,
      sessionSecret: "activity-tests-secret-".repeat(3),
      origins: [],
    }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await db.pg.close();
  });
  const base = "http://127.0.0.1:" + server.address().port,
    cookies = {};
  async function req(who, path, body) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        cookie: cookies[who] || "",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.headers.get("set-cookie"))
      cookies[who] = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, body: await r.json() };
  }
  await t.test(
    "failed logins are excluded and successful logins snapshot name and role",
    async () => {
      assert.equal(
        (
          await req("root", "/api/auth/login", {
            identifier: "root",
            password: "wrong",
          })
        ).status,
        401,
      );
      assert.equal(
        (await db.pg.query("SELECT count(*)::int n FROM login_activity"))
          .rows[0].n,
        0,
      );
      assert.equal(
        (
          await req("root", "/api/auth/login", {
            identifier: "root",
            password: "Existing-test-123!",
          })
        ).status,
        200,
      );
      const r = await req("root", "/api/admin/activities");
      assert.equal(r.status, 200);
      assert.equal(r.body.data[0].name, "Natalia Team Root");
      assert.equal(r.body.data[0].role, "superadmin");
      assert.ok(r.body.data[0].login_date);
      assert.match(r.body.data[0].login_time, /AM|PM/i);
    },
  );
  await t.test(
    "username-only mutations stamp full names across business tables",
    async () => {
      for (const [table, data] of [
        [
          "customer",
          { custno: "C9999", custname: "Audit check", payterm: "COD" },
        ],
        [
          "product",
          { prodcode: "AD9999", description: "Audit check", unit: "ea" },
        ],
      ]) {
        const r = await db.rpc("hope_mutate", {
          p_actor: ids.root,
          p_table: table,
          p_operation: "insert",
          p_key: {},
          p_data: data,
        });
        assert.equal(r.error, null);
        assert.match(r.data.stamp, /ADD Natalia Team Root/);
        const audit = (
          await db.pg.query(
            "SELECT action_by FROM audit_log WHERE table_name=$1 ORDER BY audit_id DESC LIMIT 1",
            [table],
          )
        ).rows[0];
        assert.equal(audit.action_by, "Natalia Team Root");
      }
    },
  );
  await t.test(
    "system roles show membership and privileged accounts remain scoped",
    async () => {
      const r = await req("root", "/api/admin/system-roles");
      assert.deepEqual(
        r.body.data.map((x) => x.system_role),
        ["superadmin", "admin", "user"],
      );
      assert.equal(r.body.data[0].members, 1);
      assert.equal(r.body.data[0].members_details[0].username, "root");
      for (const who of ["member", "manager"])
        assert.equal(
          (
            await req(who, "/api/auth/login", {
              identifier: who,
              password: "Existing-test-123!",
            })
          ).status,
          200,
        );
      assert.equal((await req("member", "/api/admin/activities")).status, 403);
      const admin = await req("manager", "/api/admin/activities");
      assert.ok(admin.body.data.length);
      assert.ok(admin.body.data.every((r) => r.role === "user"));
      assert.deepEqual(
        (await req("manager", "/api/admin/system-roles")).body.data.map(
          (r) => r.system_role,
        ),
        ["user"],
      );
    },
  );
  await t.test(
    "activity ordering, pagination, snapshot preservation and immutability",
    async () => {
      await db.pg.query(
        `INSERT INTO login_activity(user_id,name,role,method,logged_in_at) SELECT $1,'Earlier login','user','password',now()-interval '1 day'-g*interval '1 minute' FROM generate_series(1,205) g`,
        [ids.member],
      );
      const a = await req("root", "/api/admin/activities?limit=200"),
        b = await req("root", "/api/admin/activities?limit=200&offset=200");
      assert.equal(a.body.data.length, 200);
      assert.ok(b.body.data.length);
      for (let i = 1; i < a.body.data.length; i++)
        assert.ok(
          Date.parse(a.body.data[i - 1].logged_in_at) >=
            Date.parse(a.body.data[i].logged_in_at),
        );
      await db.pg.query("UPDATE users SET name=$1 WHERE id=$2", [
        "Renamed Person",
        ids.member,
      ]);
      assert.equal(
        (
          await db.pg.query(
            "SELECT name FROM login_activity WHERE user_id=$1 ORDER BY logged_in_at DESC LIMIT 1",
            [ids.member],
          )
        ).rows[0].name,
        "Member Person",
      );
      await assert.rejects(
        db.pg.query("DELETE FROM login_activity"),
        /append-only/,
      );
      await db.pg.exec("SET ROLE anon");
      try {
        await assert.rejects(
          db.pg.query("SELECT * FROM login_activity"),
          /permission denied/,
        );
      } finally {
        await db.pg.exec("RESET ROLE");
      }
    },
  );
});
