require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const tables = [
  "employee",
  "department",
  "job",
  "jobhistory",
  "customer",
  "sales",
  "product",
  "salesdetail",
  "payment",
  "pricehist",
  "audit_log",
  "role",
  "module",
  "rights",
  "users",
  "user_permission",
  "user_token",
  "app_session",
  "app_setting",
  "app_migration",
  "record_code_counter",
  "auth_identity",
  "permission_role",
  "price_change",
  "login_activity",
];
async function main() {
  const db = require("../src/config/supabase")();
  const result = {
    verifiedAt: new Date().toISOString(),
    project: "tlsqkmjrmcnlgucjniuv",
    tables: {},
    reports: {},
  };
  for (const table of tables) {
    const { error, count } = await db
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.code}`);
    result.tables[table] = count;
  }
  assert.equal(result.tables.rights, 41);
  assert.equal(result.tables.role, 3);
  assert.equal(result.tables.module, 5);
  assert.equal(result.tables.app_migration, 17);
  const directory=await db.from('employee_directory').select('empno,jobname,deptname',{count:'exact',head:true});
  if(directory.error)throw new Error('employee_directory: '+directory.error.code);
  assert.equal(directory.count,result.tables.employee);
  result.employeeDirectoryRows=directory.count;
  const jobDirectory=await db.from('job_directory').select('jobcode,deptcode,deptname',{count:'exact',head:true});
  if(jobDirectory.error)throw new Error('job_directory: '+jobDirectory.error.code);
  assert.equal(jobDirectory.count,result.tables.job);
  result.jobDirectoryRows=jobDirectory.count;
  for (const report of [
    "topCustomers",
    "productMaster",
    "topProducts",
    "activeEmployees",
    "allEmployees",
    "empJobHistory",
    "topSales",
  ]) {
    const { data, error } = await db.rpc("hope_report", {
      p_report: report,
      p_employee: report === "empJobHistory" ? "00000" : null,
    });
    if (error) throw new Error(`${report}: ${error.code}`);
    assert.ok(Array.isArray(data));
    result.reports[report] = { rows: data.length, ok: true };
  }
  if (process.env.SUPABASE_PUBLISHABLE_KEY) {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users?select=id`,
      { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY } },
    );
    assert.ok([401, 403].includes(res.status));
    const rolesRead=await fetch(`${process.env.SUPABASE_URL}/rest/v1/permission_role?select=id`,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY}});
    assert.ok([401,403].includes(rolesRead.status));
    result.anonymousRoleReadDenied=true;
    const directoryRead=await fetch(`${process.env.SUPABASE_URL}/rest/v1/employee_directory?select=empno`,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY}});
    assert.ok([401,403].includes(directoryRead.status));
    result.anonymousDirectoryReadDenied=true;
    const jobDirectoryRead=await fetch(`${process.env.SUPABASE_URL}/rest/v1/job_directory?select=jobcode`,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY}});
    assert.ok([401,403].includes(jobDirectoryRead.status));
    result.anonymousJobDirectoryReadDenied=true;
    const priceHistoryRead=await fetch(`${process.env.SUPABASE_URL}/rest/v1/price_change?select=id`,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY}});
    assert.ok([401,403].includes(priceHistoryRead.status));
    result.anonymousPriceHistoryReadDenied=true;
    result.anonymousReadDenied = true;
  }
  const url = `http://127.0.0.1:${process.env.PORT || 5000}`;
  const health = await fetch(url + "/api/health");
  assert.equal(health.status, 200);
  result.backendHealth = await health.json();
  for (const path of [
    "/api/customers",
    "/api/admin/users",
    "/api/reports/top-sales",
  ])
    assert.equal((await fetch(url + path)).status, 401);
  result.anonymousApiDenied = true;
  await fs.mkdir("docs/evidence", { recursive: true });
  await fs.writeFile(
    "docs/evidence/live-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
