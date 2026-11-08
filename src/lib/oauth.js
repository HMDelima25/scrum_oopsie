const { createClient } = require("@supabase/supabase-js");
const { HttpError, check } = require("./http");
function client(req) {
  if (!process.env.SUPABASE_PUBLISHABLE_KEY)
    throw new HttpError(503, "Google sign-in is not configured.");
  req.session.oauthStorage ||= {};
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        flowType: "pkce",
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
        storage: {
          getItem: (key) => req.session.oauthStorage[key] ?? null,
          setItem: (key, value) => {
            req.session.oauthStorage[key] = value;
          },
          removeItem: (key) => {
            delete req.session.oauthStorage[key];
          },
        },
      },
    },
  );
}
async function establishSession(req, user) {
  if (user.is_deleted || user.status !== "approved")
    throw new HttpError(
      403,
      user.status === "pending"
        ? "Your account is awaiting Superadmin approval."
        : "Your account is blocked.",
    );
  await new Promise((resolve, reject) =>
    req.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
  req.session.userId = user.id;
  req.session.authVersion = user.auth_version;
  await new Promise((resolve, reject) =>
    req.session.save((e) => (e ? reject(e) : resolve())),
  );
}
async function googleStart(req, res) {
  if (process.env.GOOGLE_OAUTH_ENABLED !== "true")
    throw new HttpError(
      503,
      "Google sign-in is awaiting provider configuration.",
    );
  if (req.query.link === "1" && !req.session.userId)
    throw new HttpError(401, "Sign in before linking Google.");
  if (req.query.link !== "1")
    await new Promise((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
  req.session.oauthLinkUserId =
    req.query.link === "1" ? req.session.userId : null;
  const { data, error } = await client(req).auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/api/auth/google/callback", process.env.APP_URL)
        .href,
      skipBrowserRedirect: true,
      scopes: "email profile",
    },
  });
  if (error || !data.url)
    throw new HttpError(503, "Google sign-in could not be started.");
  await new Promise((resolve, reject) =>
    req.session.save((e) => (e ? reject(e) : resolve())),
  );
  res.redirect(data.url);
}
async function googleCallback(req, res) {
  try {
    if (
      req.query.error ||
      typeof req.query.code !== "string" ||
      !req.session.oauthStorage
    )
      throw new HttpError(
        400,
        "Google sign-in was cancelled or expired. Try again.",
      );
    const auth = client(req);
    const { data, error } = await auth.auth.exchangeCodeForSession(
      req.query.code,
    );
    if (error || !data.session)
      throw new HttpError(
        401,
        "Google sign-in could not be verified. Try again.",
      );
    const verified = await auth.auth.getUser(data.session.access_token);
    const identity = verified.data?.user;
    if (
      verified.error ||
      !identity?.email_confirmed_at ||
      !identity.email ||
      !identity.identities?.some((i) => i.provider === "google")
    )
      throw new HttpError(401, "A verified Google account is required.");
    const db = req.app.locals.db;
    const address = identity.email.toLowerCase();
    let user;
    if (req.session.oauthLinkUserId) {
      user = check(
        await db
          .from("users")
          .select("*")
          .eq("id", req.session.oauthLinkUserId)
          .single(),
      );
      if (
        user.email !== address ||
        user.id !== req.session.userId ||
        user.auth_version !== req.session.authVersion
      )
        throw new HttpError(
          403,
          "Google must match your signed-in account email.",
        );
      check(
        await db.rpc("hope_attach_identity", {
          p_user: user.id,
          p_subject: identity.id,
        }),
      );
    } else {
      const link = check(
        await db
          .from("auth_identity")
          .select("user_id")
          .eq("provider", "google")
          .eq("subject", identity.id)
          .maybeSingle(),
      );
      if (link)
        user = check(
          await db.from("users").select("*").eq("id", link.user_id).single(),
        );
      else {
        const existing = check(
          await db
            .from("users")
            .select("id")
            .eq("email", address)
            .maybeSingle(),
        );
        if (existing)
          throw new HttpError(
            409,
            "This email already has an account. Sign in with email/password, then use Link Google in your profile.",
          );
        user = check(
          await db
            .from("users")
            .insert({
              name: String(identity.user_metadata.full_name || address).slice(
                0,
                160,
              ),
              email: address,
              role: "user",
              status: "pending",
            })
            .select("*")
            .single(),
        );
        check(
          await db.rpc("hope_attach_identity", {
            p_user: user.id,
            p_subject: identity.id,
          }),
        );
      }
    }
    delete req.session.oauthStorage;
    delete req.session.oauthLinkUserId;
    await establishSession(req, user);
    res.redirect(
      user.role === "user"
        ? "/UI-UX/index.html?signin=success"
        : "/UI-UX/modules/dashboard/index.html",
    );
  } catch (error) {
    delete req.session.oauthStorage;
    delete req.session.oauthLinkUserId;
    const message = error.status
      ? error.message
      : "Google sign-in could not be completed. Try again.";
    res.redirect(
      "/UI-UX/index.html?authMessage=" + encodeURIComponent(message),
    );
  }
}
module.exports = { googleStart, googleCallback, establishSession };
