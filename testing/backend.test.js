const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("./helpers/database");
const createApp = require("../backend/src/app");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
test("HOPE database and backend integration", async (t) => {
  const db = await createDatabase();
  const app = createApp({
    db,
    sessionSecret: "test-only-session-secret-".repeat(3),
    origins: ["http://localhost:4173"],
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await db.pg.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  async function request(method, url, body, headers = {}) {
    const res = await fetch(base + url, {
      method,
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.headers.get("set-cookie"))
      cookie = res.headers.get("set-cookie").split(";")[0];
    return { status: res.status, body: await res.json() };
  }
  const password = "Verification-only-password-2026";
  const password_hash = await bcrypt.hash(password, 4);
  const admin = (
    await db.pg.query(
      `INSERT INTO users(email,name,password_hash,role,status) VALUES('super@example.test','Test Superadmin',$1,'superadmin','approved') RETURNING id`,
      [password_hash],
    )
  ).rows[0].id;
  let userId;
  await t.test(
    "schema includes 25 RLS-protected tables and 36 actions plus 5 view gates",
    async () => {
      const a = await db.pg.query(
        `SELECT count(*)::int n FROM pg_tables WHERE schemaname='public' AND rowsecurity`,
      );
      assert.equal(a.rows[0].n, 25);
      assert.equal(
        (await db.pg.query("SELECT count(*)::int n FROM rights")).rows[0].n,
        41,
      );
    },
  );
  await t.test(
    "anonymous database role cannot read users or call privileged RPC",
    async () => {
      await db.pg.exec("SET ROLE anon");
      try {
        await assert.rejects(
          db.pg.query("SELECT * FROM users"),
          /permission denied/,
        );
        await assert.rejects(
          db.pg.query(`SELECT hope_report('topSales')`),
          /permission denied/,
        );
      } finally {
        await db.pg.exec("RESET ROLE");
      }
    },
  );
  await t.test("database-backed health and anonymous API denial", async () => {
    assert.equal((await request("GET", "/api/health")).body.connected, true);
    for (const path of [
      "/api/customers",
      "/api/admin/users",
      "/api/admin/users/" + admin + "/rights",
      "/api/reports/top-sales",
    ])
      assert.equal((await request("GET", path)).status, 401);
  });
  await t.test("cross-origin mutation is rejected", async () =>
    assert.equal(
      (
        await request(
          "POST",
          "/api/auth/logout",
          {},
          { origin: "https://untrusted.example" },
        )
      ).status,
      403,
    ),
  );
  await t.test(
    "registration cannot self-assign approval or admin role",
    async () => {
      const a = await request("POST", "/api/auth/register", {
        name: "Test User",
        email: "user@example.test",
        password,
        role: "superadmin",
        status: "approved",
      });
      assert.equal(a.status, 201);
      assert.equal(a.body.data.role, "user");
      assert.equal(a.body.data.status, "pending");
      assert.equal(a.body.data.password_hash, undefined);
      userId = a.body.data.id;
      assert.equal(
        (
          await request("POST", "/api/auth/login", {
            email: "user@example.test",
            password,
          })
        ).status,
        403,
      );
    },
  );
  await t.test("duplicate email and invalid inputs are rejected", async () => {
    assert.equal(
      (
        await request("POST", "/api/auth/register", {
          name: "Other",
          email: "USER@example.test",
          password,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("POST", "/api/auth/register", {
          name: "Other",
          email: "invalid",
          password,
        })
      ).status,
      400,
    );
  });
  await t.test("login never assigns a missing password", async () => {
    await db.pg.query(
      `INSERT INTO users(email,name,status) VALUES('unset@example.test','Unset','approved')`,
    );
    assert.equal(
      (
        await request("POST", "/api/auth/login", {
          email: "unset@example.test",
          password,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await db.pg.query(
          `SELECT password_hash FROM users WHERE email='unset@example.test'`,
        )
      ).rows[0].password_hash,
      null,
    );
  });
  await t.test(
    "login creates persisted session and /me loads live account",
    async () => {
      assert.equal(
        (
          await request("POST", "/api/auth/login", {
            email: "super@example.test",
            password,
          })
        ).status,
        200,
      );
      assert.equal((await request("GET", "/api/auth/me")).body.data.id, admin);
      assert.equal(
        (await db.pg.query("SELECT count(*)::int n FROM app_session")).rows[0]
          .n,
        1,
      );
    },
  );
  await t.test("last Superadmin cannot be disabled", async () => {
    await assert.rejects(
      db.pg.query(`UPDATE users SET status='blocked' WHERE id=$1`, [admin]),
      /last active Superadmin/,
    );
  });
  await t.test(
    "saved sessions remain valid across application instances",
    async () => {
      const second = createApp({
        db,
        sessionSecret: "test-only-session-secret-".repeat(3),
        origins: [],
      }).listen(0, "127.0.0.1");
      await new Promise((r) => second.once("listening", r));
      try {
        const a = await fetch(
          `http://127.0.0.1:${second.address().port}/api/auth/me`,
          { headers: { cookie } },
        );
        assert.equal(a.status, 200);
        assert.equal((await a.json()).data.id, admin);
      } finally {
        await new Promise((r) => second.close(r));
      }
    },
  );
  await t.test(
    "rights change and audit are committed together; catalogue is enforced",
    async () => {
      assert.equal(
        (
          await request("PUT", `/api/admin/users/${userId}/rights`, {
            rights: { "customers.view": true, "customers.add": true },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await db.pg.query(
            "SELECT count(*)::int n FROM user_permission WHERE user_id=$1",
            [userId],
          )
        ).rows[0].n,
        2,
      );
      const row = (
        await db.pg.query(
          `SELECT * FROM audit_log WHERE table_name='users' AND record_key=$1 ORDER BY audit_id DESC LIMIT 1`,
          [userId],
        )
      ).rows[0];
      assert.equal(row.action_by, "Test Superadmin");
      assert.equal(row.new_values.rights["customers.add"], true);
      assert.equal(row.new_values.password_hash, undefined);
      assert.equal(
        (
          await request("PUT", `/api/admin/users/${userId}/rights`, {
            rights: { "fake.add": true },
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "customer CRUD writes stamps/audit and uses soft delete/restore",
    async () => {
      assert.equal(
        (
          await request("POST", "/api/customers", {
            custno: "T0001",
            custname: "Fixture",
            address: "Test",
            payterm: "COD",
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await request("PATCH", "/api/customers/T0001", {
            custname: "Changed",
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("DELETE", "/api/customers/T0001")).status,
        200,
      );
      assert.equal(
        (await request("GET", "/api/customers")).body.data.length,
        0,
      );
      assert.equal(
        (await request("POST", "/api/customers/T0001/restore", {})).status,
        200,
      );
      const a = (await request("GET", "/api/customers/T0001")).body.data;
      assert.match(a.stamp, /RESTORE Test Superadmin/);
      await assert.rejects(
        db.pg.query(`DELETE FROM customer WHERE custno='T0001'`),
        /Hard delete/,
      );
    },
  );
  await t.test(
    "system and immutable fields cannot be written through API",
    async () => {
      assert.equal(
        (await request("PATCH", "/api/customers/T0001", { custno: "T0002" }))
          .status,
        400,
      );
      assert.equal(
        (
          await request("POST", "/api/customers", {
            custno: "T0002",
            stamp: "forged",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "create product, effective price, employee, department, job and job history",
    async () => {
      for (const [path, body] of [
        [
          "products",
          { prodcode: "TEST01", description: "Fixture", unit: "pc" },
        ],
        [
          "prices",
          { prodcode: "TEST01", effdate: "2026-01-01", unitprice: 12.5 },
        ],
        [
          "employees",
          {
            empno: "T0001",
            firstname: "Test",
            lastname: "Employee",
            hiredate: "2026-01-01",
          },
        ],
        ["departments", { deptcode: "TST", deptname: "Test" }],
        ["jobs", { jobname: "Test", deptcode: "TST", jobdesc: "Test" }],
        [
          "job-history",
          {
            empno: "T0001",
            jobcode: "TST1",
            effdate: "2026-01-01",
            salary: 1000,
            deptcode: "TST",
          },
        ],
      ]) {
        const result = await request("POST", "/api/" + path, body);
        assert.equal(result.status, 201, JSON.stringify(result));
      }
    },
  );
  let transno;
  await t.test(
    "sale header and lines commit atomically with generated number",
    async () => {
      const result = await request("POST", "/api/sales", {
        salesdate: "2026-02-01",
        custno: "T0001",
        empno: "T0001",
        lines: [{ prodcode: "TEST01", quantity: 2 }],
      });
      assert.equal(result.status, 201, JSON.stringify(result));
      transno = result.body.data.transno;
      assert.match(transno, /^TR\d{6}$/);
      const before = (await db.pg.query("SELECT count(*)::int n FROM sales"))
        .rows[0].n;
      assert.equal(
        (
          await request("POST", "/api/sales", {
            salesdate: "2025-01-01",
            custno: "T0001",
            empno: "T0001",
            lines: [{ prodcode: "TEST01", quantity: 2 }],
          })
        ).status,
        400,
      );
      assert.equal(
        (await db.pg.query("SELECT count(*)::int n FROM sales")).rows[0].n,
        before,
      );
    },
  );
  await t.test(
    "payment records and balance avoid join multiplication",
    async () => {
      assert.equal(
        (
          await request("POST", "/api/payments", {
            orno: "T0000001",
            paydate: "2026-02-02",
            amount: 10,
            transno,
          })
        ).status,
        201,
      );
      const a = (
        await db.pg.query(
          "SELECT total,paid,balance FROM sales_balance WHERE transno=$1",
          [transno],
        )
      ).rows[0];
      assert.equal(Number(a.total), 25);
      assert.equal(Number(a.paid), 10);
      assert.equal(Number(a.balance), 15);
    },
  );
  await t.test("active children block parent soft deletion", async () => {
    assert.equal((await request("DELETE", "/api/customers/T0001")).status, 400);
    assert.equal((await request("DELETE", "/api/products/TEST01")).status, 400);
  });
  await t.test("new child cannot attach to a soft-deleted parent", async () => {
    await db.pg.query(
      `INSERT INTO product(prodcode,description,unit,is_deleted) VALUES('TEST02','Inactive','pc',true)`,
    );
    assert.equal(
      (
        await request("POST", "/api/prices", {
          prodcode: "TEST02",
          effdate: "2026-01-01",
          unitprice: 20,
        })
      ).status,
      400,
    );
  });
  await t.test("all seven reports return computed results", async () => {
    for (const path of [
      "top-customers",
      "product-master-list",
      "top-products",
      "active-employees",
      "all-employees",
      "employee-job-history?employee=T0001",
      "top-sales",
    ]) {
      const result = await request("GET", "/api/reports/" + path);
      assert.equal(result.status, 200, JSON.stringify(result));
      assert.equal(result.body.data.length, 1, path);
    }
    assert.equal(
      (await request("GET", "/api/reports/top-sales?from=2027-01-01")).body.data
        .length,
      0,
    );
  });
  await t.test(
    "audit log is append-only",
    async () =>
      await assert.rejects(
        db.pg.query(`UPDATE audit_log SET action_by='forged'`),
        /append-only/,
      ),
  );
  await t.test(
    "approve User, then enforce action rights and hide system columns",
    async () => {
      assert.equal(
        (
          await request("PUT", `/api/admin/users/${userId}`, {
            status: "approved",
          })
        ).status,
        200,
      );
      cookie = "";
      assert.equal(
        (
          await request("POST", "/api/auth/login", {
            email: "user@example.test",
            password,
          })
        ).status,
        200,
      );
      const a = await request("GET", "/api/customers");
      assert.equal(a.status, 200);
      assert.equal(a.body.data[0].stamp, undefined);
      assert.equal(a.body.data[0].is_deleted, undefined);
      const added = await request("POST", "/api/customers", {
        custno: "T0002",
        custname: "User created",
        address: "Fixture",
        payterm: "COD",
      });
      assert.equal(added.status, 201);
      assert.equal(added.body.data.stamp, undefined);
      assert.equal(added.body.data.is_deleted, undefined);
      assert.equal((await request("GET", "/api/products")).status, 403);
      assert.equal((await request("GET", "/api/admin/users")).status, 403);
      assert.equal(
        (
          await request("PATCH", "/api/customers/T0001", {
            custname: "Unauthorized",
          })
        ).status,
        403,
      );
    },
  );
  await t.test(
    "changed rights apply on next request, module gate disables actions",
    async () => {
      await db.pg.query(
        `UPDATE users SET rights='{"customers.view":false,"customers.add":true}' WHERE id=$1`,
        [userId],
      );
      assert.equal((await request("GET", "/api/customers")).status, 403);
      assert.equal(
        (await request("POST", "/api/customers", { custno: "T0002" })).status,
        403,
      );
    },
  );
  await t.test("blocking a user invalidates an existing session", async () => {
    await db.pg.query(`UPDATE users SET status='blocked' WHERE id=$1`, [
      userId,
    ]);
    assert.equal((await request("GET", "/api/auth/me")).status, 401);
  });
  await t.test(
    "Admin cannot manage another Admin, promote Users, or assign Superadmin",
    async () => {
      await db.pg.query(
        `INSERT INTO users(email,name,password_hash,role,status) VALUES('admin@example.test','Test Admin',$1,'admin','approved')`,
        [password_hash],
      );
      cookie = "";
      assert.equal(
        (
          await request("POST", "/api/auth/login", {
            email: "admin@example.test",
            password,
          })
        ).status,
        200,
      );
      const list = await request("GET", "/api/admin/users");
      assert.ok(list.body.data.every((u) => u.role === "user"));
      assert.equal(
        (
          await request("PUT", `/api/admin/users/${admin}/rights`, {
            rights: {},
          })
        ).status,
        403,
      );
      assert.equal(
        (await request("PUT", `/api/admin/users/${userId}`, { role: "admin" }))
          .status,
        403,
      );
      assert.equal(
        (
          await request("POST", "/api/admin/users", {
            name: "Escalation",
            email: "no@example.test",
            role: "superadmin",
          })
        ).status,
        403,
      );
    },
  );
  await t.test(
    "password token is hashed, single-use, expiring and invalidates old sessions",
    async () => {
      const token = crypto.randomBytes(32).toString("hex");
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      await db.pg.query(
        `INSERT INTO user_token(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'reset',now()+interval '1 hour')`,
        [userId, hash],
      );
      cookie = "";
      assert.equal(
        (
          await request("POST", "/api/auth/reset-password", {
            token,
            newPassword: password,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request("POST", "/api/auth/reset-password", {
            token,
            newPassword: password,
          })
        ).status,
        400,
      );
      await db.pg.query(
        `INSERT INTO user_token(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'reset',now()-interval '1 hour')`,
        [userId, hash + "expired"],
      );
      const result = await db.rpc("hope_consume_token", {
        p_hash: hash + "expired",
        p_password_hash: password_hash,
      });
      assert.equal(result.error.code, "22023");
    },
  );
  await t.test(
    "a successful password reset invalidates a previously valid session",
    async () => {
      cookie = "";
      assert.equal(
        (
          await request("POST", "/api/auth/login", {
            email: "super@example.test",
            password,
          })
        ).status,
        200,
      );
      const token = crypto.randomBytes(32).toString("hex");
      const digest = crypto.createHash("sha256").update(token).digest("hex");
      await db.pg.query(
        `INSERT INTO user_token(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'reset',now()+interval '1 hour')`,
        [admin, digest],
      );
      assert.equal(
        (
          await request("POST", "/api/auth/reset-password", {
            token,
            newPassword: password + "new",
          })
        ).status,
        200,
      );
      assert.equal((await request("GET", "/api/auth/me")).status, 401);
    },
  );
  await t.test(
    "forgot-password never returns a debug token without configured delivery",
    async () => {
      const saved = process.env.MAIL_DELIVERY;
      delete process.env.MAIL_DELIVERY;
      try {
        const a = await request("POST", "/api/auth/forgot-password", {
          email: "user@example.test",
        });
        assert.equal(a.status, 503);
        assert.equal(a.body.debugToken, undefined);
      } finally {
        if (saved) process.env.MAIL_DELIVERY = saved;
      }
    },
  );
});
