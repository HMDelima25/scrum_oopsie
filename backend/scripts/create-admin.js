// Private operator tool. The password comes from stdin, never from source/env defaults.
require("dotenv").config({ quiet: true });
const bcrypt = require("bcryptjs");
const { check } = require("../src/lib/http");
(async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const password = Buffer.concat(chunks).toString("utf8").trim();
  const username = (process.argv[2] || "").toLowerCase();
  if (
    !/^[a-z][a-z0-9._-]{2,31}$/.test(username) ||
    password.length < 8 ||
    Buffer.byteLength(password) > 72
  )
    throw new Error("Provide a valid username and a password on stdin.");
  const db = require("../src/config/supabase")();
  const existing = check(
    await db
      .from("users")
      .select("id,role")
      .eq("username", username)
      .maybeSingle(),
  );
  if (existing)
    throw new Error("That username already exists; no account was changed.");
  const rights = Object.fromEntries(
    Object.keys(require("../src/config/rights.json")).map((k) => [k, true]),
  );
  const user = check(
    await db
      .from("users")
      .insert({
        username,
        name: "Administrator",
        email: null,
        password_hash: await bcrypt.hash(password, 12),
        role: "admin",
        status: "approved",
        rights,
      })
      .select("id,username,role,status")
      .single(),
  );
  console.log(JSON.stringify(user));
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
