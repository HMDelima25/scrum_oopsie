const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ quiet: true });
module.exports = function createDatabase() {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key)
    throw new Error(
      "Set SUPABASE_URL and a server-only Supabase secret key in .env.",
    );
  if (/server-only-key-from|paste|replace-with/i.test(key))
    throw new Error('The Supabase key in .env is still an example. Configure a real server-only key, then run npm run doctor.');
  if (key.startsWith('sb_publishable_'))
    throw new Error('A Supabase publishable key cannot run this backend. Configure a server-only secret/service-role key, then run npm run doctor.');
  return createClient(process.env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
