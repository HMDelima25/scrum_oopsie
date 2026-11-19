require("dotenv").config({ quiet: true });
const { email } = require("../src/lib/http");
const { issueToken } = require("../src/lib/tokens");
(async () => {
  const db = require("../src/config/supabase")();
  const { data: user, error } = await db
    .from("users")
    .select("id,email,status,is_deleted")
    .eq("email", email(process.argv[2]))
    .single();
  if (error || !user || user.status !== "approved" || user.is_deleted)
    throw new Error("Approved account not found.");
  await issueToken(db, user, "setup");
  console.log(
    "Setup delivery completed using the configured mail delivery mode.",
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
