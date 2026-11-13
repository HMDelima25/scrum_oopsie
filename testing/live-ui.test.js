const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { createDatabase } = require("./helpers/database");
const createApp = require("../backend/src/app");
test("Live UI contracts, lookups and external edit conflicts", async (t) => {
  const db = await createDatabase();
  const password = "Local-only-contract-test";
  const user = (
    await db.pg.query(
      `INSERT INTO users(email,name,role,status,password_hash) VALUES('ui@example.test','UI Test','superadmin','approved',$1) RETURNING id`,
      [await bcrypt.hash(password, 4)],
    )
  ).rows[0];
  const server = createApp({
    db,
    sessionSecret: "ui-contract-test-secret-".repeat(3),
    origins: [],
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await db.pg.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  let cookie = "";
  async function req(path, method = "GET", body, headers = {}) {
    const r = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", cookie, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, body: await r.json() };
  }
  assert.equal(
    (
      await req("/api/auth/login", "POST", {
        email: "ui@example.test",
        password,
      })
    ).status,
    200,
  );
  await t.test(
    "schema contract matches database field labels and lookup mappings",
    async () => {
      const r = await req("/api/ui-schema");
      assert.equal(r.status, 200);
      assert.equal(r.body.data.fields.custno[2], 5);
      assert.equal(r.body.data.lookups.sales.custno, "customers");
      assert.equal(r.body.data.resources.sales.pk[0], "transno");
    },
  );
  await t.test(
    "lookup values reflect newly inserted and directly edited database records",
    async () => {
      await req("/api/customers", "POST", {
        custno: "UI001",
        custname: "Initial name",
        address: "Test",
        payterm: "COD",
      });
      assert.equal(
        (await req("/api/lookups/customers?for=sales")).body.data[0].custname,
        "Initial name",
      );
      await db.pg.query(
        `UPDATE customer SET custname='External edit' WHERE custno='UI001'`,
      );
      assert.equal(
        (await req("/api/lookups/customers?for=sales")).body.data[0].custname,
        "External edit",
      );
    },
  );
  await t.test(
    "fresh form version saves, but stale form cannot overwrite external edits",
    async () => {
      let row = (await req("/api/customers/UI001")).body.data;
      const a = await req(
        "/api/customers/UI001",
        "PATCH",
        { custname: "Form saved" },
        { "if-match": JSON.stringify(row.updated_at) },
      );
      assert.equal(a.status, 200, JSON.stringify(a));
      row = (await req("/api/customers/UI001")).body.data;
      await db.pg.query(
        `UPDATE customer SET custname='Supabase wins' WHERE custno='UI001'`,
      );
      const stale = await req(
        "/api/customers/UI001",
        "PATCH",
        { custname: "Stale form" },
        { "if-match": JSON.stringify(row.updated_at) },
      );
      assert.equal(stale.status, 409, JSON.stringify(stale));
      assert.equal(
        (await req("/api/customers/UI001")).body.data.custname,
        "Supabase wins",
      );
    },
  );
  await t.test(
    "purpose-scoped lookups reject inappropriate or unknown combinations",
    async () => {
      assert.equal(
        (await req("/api/lookups/customers?for=prices")).status,
        400,
      );
      assert.equal((await req("/api/lookups/users?for=sales")).status, 400);
    },
  );
  await t.test("effective date choices use stored product prices", async () => {
    await req("/api/products", "POST", {
      prodcode: "UI0001",
      description: "Fixture product",
      unit: "pc",
    });
    await req("/api/prices", "POST", {
      prodcode: "UI0001",
      effdate: "2026-01-01",
      unitprice: 12.5,
    });
    assert.equal(
      Number(
        (await req("/api/sale-price?product=UI0001&date=2026-02-01")).body.data
          .unitprice,
      ),
      12.5,
    );
    assert.equal(
      (await req("/api/sale-price?product=UI0001&date=2025-02-01")).body.data,
      null,
    );
    const list = await req("/api/products");
    assert.equal(Number(list.body.data[0].current_price), 12.5);
  });
  await t.test("related-record filters isolate the requested product and preserve record permissions", async () => {
    await db.pg.query("INSERT INTO product(prodcode,description,unit) VALUES ('LINK01','Linked product','ea'),('LINK02','Other product','ea')");
    await db.pg.query("INSERT INTO pricehist(effdate,prodcode,unitprice) VALUES ('2026-11-01','LINK01',10),('2026-11-02','LINK02',20)");
    const result=await req("/api/prices?prodcode=LINK01");
    assert.equal(result.status,200);
    assert.equal(result.body.count,1);
    assert.ok(result.body.data.every(row=>row.prodcode==='LINK01'));
    assert.equal((await req('/api/prices?prodcode=LINK01&prodcode=LINK02')).status,400);
    const contract=(await req('/api/ui-schema')).body.data;
    assert.equal(contract.cellLinks.sales.custno.resource,'customers');
    assert.equal(contract.cellLinks.sales.paid.resource,'payments');
    await db.pg.query("INSERT INTO users(email,name,role,status,password_hash) VALUES('links-user@example.test','Restricted user','user','approved',$1)",[await bcrypt.hash(password,4)]);
    const adminCookie=cookie;
    await req('/api/auth/login','POST',{email:'links-user@example.test',password});
    assert.equal((await req('/api/prices?prodcode=LINK01')).status,403);
    assert.equal((await req('/api/products/LINK01')).status,403);
    await req("/api/auth/login","POST",{email:"ui@example.test",password});
  });
  await t.test("workspace bootstrap returns permitted records in one response without account secrets",async()=>{
    const boot=await req('/api/ui-bootstrap?screen=products&view=prices&prodcode=LINK01');
    assert.equal(boot.status,200);assert.equal(boot.body.data.view,'prices');
    assert.equal(boot.body.data.records.count,1);assert.equal(boot.body.data.records.data[0].prodcode,'LINK01');
    assert.equal(boot.body.data.user.password_hash,undefined);
    const dashboard=await req('/api/ui-dashboard-data');
    assert.equal(dashboard.status,200);assert.ok(dashboard.body.data.records.products.some(r=>r.prodcode==='LINK01'));
    const adminCookie=cookie;
    await req('/api/auth/login','POST',{email:'links-user@example.test',password});
    const restricted=await req('/api/ui-dashboard-data');
    assert.ok(Object.values(restricted.body.data.records).every(rows=>rows.length===0));
    const denied=await req('/api/ui-bootstrap?screen=products&view=prices');
    assert.equal(denied.body.data.records,null);
    await req("/api/auth/login","POST",{email:"ui@example.test",password});
  });
  await t.test("automatic IDs follow stored formats, survive inactive rows and concurrent inserts",async()=>{
    await db.pg.query("INSERT INTO customer(custno,custname) VALUES('C0082','Existing company')");
    await db.pg.query("INSERT INTO employee(empno,firstname) VALUES('00063','Existing')");
    await db.pg.query("INSERT INTO product(prodcode,description,unit) VALUES('AD0004','Existing drive','ea')");
    await db.pg.query("INSERT INTO department(deptcode,deptname) VALUES('BR2','Existing branch')");
    await db.pg.query("INSERT INTO job(jobcode,jobdesc) VALUES('SA2','Existing sales job')");
    await db.pg.query("INSERT INTO department(deptcode,deptname) VALUES('SA','Sales')");
    assert.equal((await req('/api/next-code/customers')).body.data.code,'C0083');
    assert.equal((await req('/api/next-code/employees')).body.data.code,'00065');
    assert.equal((await req('/api/next-code/products?prefix=AD')).body.data.code,'AD0005');
    assert.equal((await req('/api/next-code/departments?prefix=BR')).body.data.code,'BR3');
    assert.equal((await req('/api/next-code/jobs?deptcode=SA')).body.data.code,'SA3');
    assert.equal((await req('/api/next-code/products?prefix=BAD!')).status,400);
    const created=await Promise.all([req('/api/customers','POST',{custname:'Automatic one',address:'Test',payterm:'COD'}),req('/api/customers','POST',{custname:'Automatic two',address:'Test',payterm:'COD'})]);
    assert.ok(created.every(r=>r.status===201),JSON.stringify(created));
    assert.deepEqual(created.map(r=>r.body.data.custno).sort(),['C0083','C0084']);
    assert.equal((await req('/api/employees','POST',{firstname:'Automatic',lastname:'Employee'})).body.data.empno,'00065');
    const product=await req('/api/products','POST',{description:'Automatic drive',unit:'ea',_code_prefix:'AD'});
    assert.equal(product.body.data.prodcode,'AD0005');
    assert.equal((await req('/api/departments','POST',{deptname:'New branch',_code_prefix:'BR'})).body.data.deptcode,'BR3');
    assert.equal((await req('/api/jobs','POST',{jobname:'Sales',deptcode:'SA',jobdesc:'New sales job'})).body.data.jobcode,'SA3');
    await db.pg.query("UPDATE customer SET is_deleted=true WHERE custno='C0084'");
    assert.equal((await req('/api/next-code/customers')).body.data.code,'C0085');
    await db.pg.query("INSERT INTO sales(transno,salesdate,custno,empno) VALUES('TR000124','2026-11-07','C0082','00063')");
    await req('/api/prices','POST',{prodcode:'AD0005',effdate:'2026-01-01',unitprice:10});
    const sale=await req('/api/sales','POST',{salesdate:'2026-11-07',custno:'C0082',empno:'00063',lines:[{prodcode:'AD0005',quantity:1}]});
    assert.equal(sale.status,201,JSON.stringify(sale));assert.equal(sale.body.data.transno,'TR000125');
    await db.pg.query("INSERT INTO payment(orno,transno,amount) VALUES('OR000165','TR000124',1)");
    const payment=await req('/api/payments','POST',{transno:'TR000125',paydate:'2026-11-07',amount:5});
    assert.equal(payment.status,201,JSON.stringify(payment));assert.equal(payment.body.data.orno,'OR000166');
    await req('/api/auth/login','POST',{email:'links-user@example.test',password});
    assert.equal((await req('/api/next-code/customers')).status,403);
    await req('/api/auth/login','POST',{email:'ui@example.test',password});
  });
  await t.test(
    "restored Admin entry pages and live scripts are served by the backend",
    async () => {
      for (const page of [
        "dashboard",
        "customers",
        "products",
        "human-resources",
        "sales",
        "user-management",
        "reports",
        "administrator",
      ]) {
        const r = await fetch(base + "/UI-UX/modules/" + page + "/index.html");
        assert.equal(r.status, 200);
        const html = await r.text();
        assert.ok(html.includes(page === "dashboard" ? "dashboard-live.js" : "live-admin.js"));
        assert.ok(!html.includes("module-data.js"));
      }
    },
  );
});

