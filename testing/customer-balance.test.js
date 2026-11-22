const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { createDatabase } = require("./helpers/database");
const createApp = require("../backend/src/app");

test("customer outstanding balances include active unpaid sales", async (t) => {
  const db = await createDatabase();
  const password = "Customer-balance-test-password";
  await db.pg.query(
    `INSERT INTO users(email,name,role,status,password_hash) VALUES
      ('balance-root@example.test','Balance Root','superadmin','approved',$1),
      ('balance-customer-only@example.test','Customer Only','user','approved',$1)`,
    [await bcrypt.hash(password, 4)],
  );
  await db.pg.query(
    `UPDATE users SET rights=$1 WHERE email='balance-customer-only@example.test'`,
    [{ "customers.view": true }],
  );
  await db.pg.exec(`
    INSERT INTO customer(custno,custname,address,payterm) VALUES
      ('BAL01','Balance One','Test','COD'),
      ('BAL02','Balance Two','Test','COD'),
      ('BAL03','No Sales','Test','COD');
    INSERT INTO employee(empno,firstname,lastname,hiredate) VALUES
      ('B0001','Balance','Tester','2020-01-01');
    INSERT INTO product(prodcode,description,unit) VALUES
      ('BAL001','Balance product','pc');
    INSERT INTO pricehist(prodcode,effdate,unitprice) VALUES
      ('BAL001','2026-01-01',100);
    INSERT INTO sales(transno,salesdate,custno,empno) VALUES
      ('TR900001','2026-02-01','BAL01','B0001'),
      ('TR900002','2026-02-02','BAL01','B0001'),
      ('TR900003','2026-02-03','BAL01','B0001'),
      ('TR900004','2026-02-04','BAL01','B0001'),
      ('TR900005','2026-02-05','BAL02','B0001');
    INSERT INTO salesdetail(transno,prodcode,quantity) VALUES
      ('TR900001','BAL001',2),
      ('TR900002','BAL001',1),
      ('TR900003','BAL001',1),
      ('TR900004','BAL001',5),
      ('TR900005','BAL001',1);
    INSERT INTO payment(orno,paydate,amount,transno) VALUES
      ('OR900001','2026-02-10',50,'TR900001'),
      ('OR900002','2026-02-10',100,'TR900002'),
      ('OR900003','2026-02-10',150,'TR900003'),
      ('OR900005','2026-02-10',100,'TR900005');
    UPDATE salesdetail SET is_deleted=true WHERE transno='TR900004';
    UPDATE sales SET is_deleted=true WHERE transno='TR900004';
    UPDATE payment SET is_deleted=true WHERE orno='OR900005';
  `);

  const server = createApp({
    db,
    sessionSecret: "customer-balance-contract-secret-".repeat(2),
    origins: [],
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.pg.close();
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const cookies = {};
  async function req(as, path, method = "GET", body) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(cookies[as] ? { cookie: cookies[as] } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get("set-cookie"))
      cookies[as] = response.headers.get("set-cookie").split(";")[0];
    return { status: response.status, body: await response.json() };
  }
  for (const [as, email] of [
    ["root", "balance-root@example.test"],
    ["customerOnly", "balance-customer-only@example.test"],
  ]) {
    assert.equal(
      (
        await req(as, "/api/auth/login", "POST", {
          email,
          password,
        })
      ).status,
      200,
    );
  }

  await t.test("list and profile show summed outstanding balances", async () => {
    const list = await req(
      "root",
      "/api/customers?sort=outstanding_balance&direction=desc",
    );
    assert.equal(list.status, 200, JSON.stringify(list));
    const balances = Object.fromEntries(
      list.body.data.map((row) => [row.custno, Number(row.outstanding_balance)]),
    );
    assert.deepEqual(balances, { BAL01: 150, BAL02: 100, BAL03: 0 });

    const profile = await req("root", "/api/customers/BAL01");
    assert.equal(profile.status, 200);
    assert.equal(Number(profile.body.data.outstanding_balance), 150);
    const schema = await req("root", "/api/ui-schema");
    assert.deepEqual(schema.body.data.cellLinks.customers.outstanding_balance, {
      resource: "sales",
      filter: ["custno"],
    });
    const sales = await req("root", "/api/sales?custno=BAL01");
    assert.equal(sales.status, 200);
    assert.equal(sales.body.count, 3);
    assert.deepEqual(
      sales.body.data.map((row) => Number(row.balance)).sort((a, b) => a - b),
      [-50, 0, 150],
    );
  });

  await t.test("customer-only access does not expose or sort by sales balances", async () => {
    const list = await req("customerOnly", "/api/customers");
    assert.equal(list.status, 200, JSON.stringify(list));
    assert.ok(list.body.data.every((row) => !("outstanding_balance" in row)));
    const profile = await req("customerOnly", "/api/customers/BAL01");
    assert.equal(profile.status, 200);
    assert.equal(profile.body.data.outstanding_balance, undefined);
    assert.equal(
      (
        await req(
          "customerOnly",
          "/api/customers?sort=outstanding_balance",
        )
      ).status,
      400,
    );
  });
});
