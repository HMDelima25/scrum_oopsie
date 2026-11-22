const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { createDatabase } = require("./helpers/database");
const createApp = require("../backend/src/app");
test("Registration decisions are listed with the applicant and the deciding administrator", async (t) => {
  const db = await createDatabase(),
    hash = await bcrypt.hash("Fixture-auth-2026!", 4),
    ids = {};
  for (const [username, name, role, status] of [
    ["root", "History Superadmin", "superadmin", "approved"],
    ["manager", "History Admin", "admin", "approved"],
    ["member", "History User", "user", "approved"],
    ["spare", "Spare User", "user", "approved"],
    ["yes-please", "Yes Please", "user", "pending"],
    ["no-thanks", "No Thanks", "user", "pending"],
    ["edited", "Edited Pending", "user", "pending"],
  ])
    ids[username] = (
      await db.pg.query(
        "INSERT INTO users(username,email,name,role,status,password_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
        [username, username + "@example.test", name, role, status, hash],
      )
    ).rows[0].id;
  const server = createApp({
    db,
    sessionSecret: "registration-history-test-secret-".repeat(2),
    origins: [],
    accountDecisionMailer: async () => {},
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await db.pg.close();
  });
  const base = "http://127.0.0.1:" + server.address().port,
    cookies = {};
  async function req(who, path, body, version, method) {
    const r = await fetch(base + path, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        "content-type": "application/json",
        cookie: cookies[who] || "",
        ...(version ? { "if-match": JSON.stringify(version) } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.headers.get("set-cookie")) cookies[who] = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, body: await r.json() };
  }
  const version = async (username) =>
    (await db.pg.query("SELECT updated_at FROM users WHERE id=$1", [ids[username]])).rows[0].updated_at.toISOString();
  for (const who of ["root", "manager", "member"])
    assert.equal((await req(who, "/api/auth/login", { identifier: who, password: "Fixture-auth-2026!" })).status, 200);

  assert.equal((await req("root", `/api/admin/users/${ids["yes-please"]}/review`, { decision: "approved" }, await version("yes-please"))).status, 200);
  assert.equal((await req("root", `/api/admin/users/${ids["no-thanks"]}/review`, { decision: "disapproved" }, await version("no-thanks"))).status, 200);
  // Status changes that are not a pending-registration decision are not listed.
  await db.pg.query("UPDATE users SET status='blocked' WHERE id=$1", [ids.spare]);

  const history = await req("manager", "/api/admin/registration-decisions");
  assert.equal(history.status, 200);
  assert.equal(history.body.data.length, 2);
  const byEmail = Object.fromEntries(history.body.data.map((r) => [r.email, r]));
  assert.deepEqual(
    { ...byEmail["yes-please@example.test"], decided_on: undefined },
    { decided_on: undefined, decision: "Approved", name: "Yes Please", email: "yes-please@example.test", username: "yes-please", decided_by: "History Superadmin", decided_by_email: "root@example.test" },
  );
  assert.equal(byEmail["no-thanks@example.test"].decision, "Disapproved");
  assert.equal(byEmail["no-thanks@example.test"].decided_by, "History Superadmin");
  assert.match(byEmail["no-thanks@example.test"].decided_on, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

  // Decisions made through the edit form are captured too.
  const edited = await db.pg.query("SELECT * FROM users WHERE id=$1", [ids.edited]);
  assert.equal((await req("root", `/api/admin/users/${ids.edited}`, { status: "approved" }, edited.rows[0].updated_at.toISOString(), "PUT")).status, 200);
  const after = (await req("root", "/api/admin/registration-decisions")).body.data;
  assert.equal(after.length, 3);
  assert.equal(after.find((r) => r.username === "edited").decided_by, "History Superadmin");

  assert.equal((await req("member", "/api/admin/registration-decisions")).status, 403);
  await db.pg.exec("SET ROLE anon");
  try {
    await assert.rejects(db.pg.query("SELECT * FROM registration_decision"), /permission denied/);
  } finally {
    await db.pg.exec("RESET ROLE");
  }
});
