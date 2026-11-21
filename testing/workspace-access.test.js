const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { createDatabase } = require("./helpers/database");
const createApp = require("../backend/src/app");

test("separate User, Staff and Admin workspaces preserve permission enforcement", async (t) => {
  const db = await createDatabase();
  const password = "Workspace-routing-only-2026!";
  const hash = await bcrypt.hash(password, 4);
  const permissionRole = (
    await db.pg.query(
      "INSERT INTO permission_role(name,description,rights) VALUES('Customer Staff','Customer records only',$1) RETURNING id",
      [{ "customers.view": true, "hr.view": true }],
    )
  ).rows[0];
  const userPermissionRole = (
    await db.pg.query("SELECT id FROM permission_role WHERE name='User'")
  ).rows[0];
  await db.pg.query(
    `INSERT INTO users(email,name,role,status,password_hash,permission_role_id,rights) VALUES
      ('user-workspace@example.test','Website User','user','approved',$1,$4,'{}'),
      ('staff-workspace@example.test','Customer Staff','user','approved',$1,$2,$3),
      ('admin-workspace@example.test','Workspace Admin','admin','approved',$1,NULL,'{}')`,
    [hash, permissionRole.id, { "customers.view": true, "hr.view": true }, userPermissionRole.id],
  );
  await db.pg.query("INSERT INTO employee(empno,lastname,firstname,gender,birthdate,hiredate) VALUES('P0001','Private','Person','F','1990-01-02','2020-01-01')");
  const server = createApp({
    db,
    sessionSecret: "workspace-routing-test-secret-".repeat(3),
    origins: [],
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.pg.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function login(email) {
    const response = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return {
      response,
      body: await response.json(),
      cookie: response.headers.get("set-cookie").split(";")[0],
    };
  }

  const user = await login("user-workspace@example.test");
  assert.equal(user.response.status, 200);
  assert.equal(user.body.data.workspace, "user");
  assert.equal(user.body.data.permission_role.name, "User");

  const staff = await login("staff-workspace@example.test");
  assert.equal(staff.response.status, 200);
  assert.equal(staff.body.data.workspace, "staff");
  assert.equal(staff.body.data.permission_role.name, "Customer Staff");
  assert.equal(staff.body.data.password_hash, undefined);
  assert.equal(
    (await fetch(base + "/api/customers", { headers: { cookie: staff.cookie } })).status,
    200,
  );
  assert.equal(
    (await fetch(base + "/api/products", { headers: { cookie: staff.cookie } })).status,
    403,
  );
  const employees = await fetch(base + "/api/employees", { headers: { cookie: staff.cookie } });
  assert.equal(employees.status, 200);
  const employeeRows = (await employees.json()).data;
  assert.equal(employeeRows[0].birthdate, undefined);

  const admin = await login("admin-workspace@example.test");
  assert.equal(admin.response.status, 200);
  assert.equal(admin.body.data.workspace, "admin");

  for (const path of [
    "/UI-UX/staff/modules/dashboard/index.html",
    "/UI-UX/staff/modules/customers/index.html",
    "/UI-UX/staff/modules/products/index.html",
    "/UI-UX/staff/modules/human-resources/index.html",
    "/UI-UX/staff/modules/sales/index.html",
    "/UI-UX/staff/modules/reports/index.html",
    "/UI-UX/staff/profile/index.html",
    "/UI-UX/staff/access/index.html",
    "/UI-UX/staff/security/index.html",
    "/UI-UX/user/dashboard/index.html",
    "/UI-UX/user/profile/index.html",
    "/UI-UX/user/access/index.html",
    "/UI-UX/user/security/index.html",
  ]) assert.equal((await fetch(base + path)).status, 200, path);
});
