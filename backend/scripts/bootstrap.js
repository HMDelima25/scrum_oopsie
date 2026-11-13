require("dotenv").config({ quiet: true });
const { text, email } = require("../src/lib/http");
const { issueToken } = require("../src/lib/tokens");
// Run from this private backend checkout. Passwords are set by the account owner
// through a one-time setup link; no default password is created or printed.
async function main() {
  const address = email(process.argv[2]);
  const name = text(process.argv.slice(3).join(" "), "Name");
  const db = require("../src/config/supabase")();
  const { data: existing, error } = await db
    .from("users")
    .select("id")
    .eq("role", "superadmin")
    .eq("is_deleted", false)
    .limit(1);
  if (error) throw new Error("Could not check administrator setup.");
  if (existing.length)
    throw new Error(
      "A Superadmin already exists. Use the established account-management workflow.",
    );
  // Operational bootstrap only; the CLI must not be exposed through an HTTP route.
  const { data: user, error: insertError } = await db
    .from("users")
    .insert({ email: address, name, role: "superadmin", status: "approved" })
    .select("id,email")
    .single();
  if (insertError) throw new Error("Could not create the initial Superadmin.");
  try {
    await issueToken(db, user, "setup");
  } catch (error) {
    console.error(
      "Account exists without a password. Configure delivery and use scripts/send-setup.js with the same email to retry.",
    );
    throw error;
  }
  console.log(
    process.env.MAIL_DELIVERY === "local"
      ? "Superadmin created. Open the newest private var/outbox JSON file and follow its setup link. No email was sent."
      : "Superadmin created; a setup email was sent.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
