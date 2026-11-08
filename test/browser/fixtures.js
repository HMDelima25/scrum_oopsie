const bcrypt = require("bcryptjs");
const { createDatabase } = require("../helpers/database");
const createApp = require("../../src/app");
// Synthetic accounts only. This is not a production password or default account.
const password = "Browser-fixture-only-2026!";
async function buildFixtures(origin) {
  const db = await createDatabase();
  const hash = await bcrypt.hash(password, 4);
  const ids = {};
  const users = [
    ["qa-root", "QA Superadmin", "superadmin", "approved"],
    ["qa-admin", "QA Admin", "admin", "approved"],
    ["qa-user", "QA User", "user", "approved"],
    ["qa-managed", "QA Managed User", "user", "approved"],
    ["qa-pending", "QA Pending User", "user", "pending"],
    ["qa-blocked", "QA Blocked User", "user", "blocked"],
  ];
  for (const [username, name, role, status] of users) {
    const rights =
      role === "superadmin"
        ? {}
        : { "customers.view": true, "customers.add": role === "admin" };
    ids[username] = (
      await db.pg.query(
        "INSERT INTO users(username,email,name,role,status,password_hash,rights) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
        [
          username,
          username + "@example.test",
          name,
          role,
          status,
          hash,
          rights,
        ],
      )
    ).rows[0].id;
  }
  await db.pg.query(
    "INSERT INTO customer(custno,custname,payterm,address) VALUES('C0001','QA Customer','COD','Synthetic test data')",
  );
  const app = createApp({
    db,
    sessionSecret: "isolated-browser-fixture-secret-".repeat(2),
    origins: [origin],
  });
  return { db, app, ids };
}
module.exports = { buildFixtures, password };
