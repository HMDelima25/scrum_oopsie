const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ quiet: true });
module.exports = function createDatabase() {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key)
    throw new Error(
      "Set SUPABASE_URL and a server-only Supabase secret key in .env.",
    );
  return createClient(process.env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
