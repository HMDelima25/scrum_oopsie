const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const { HttpError } = require("./lib/http");
const SupabaseSessionStore = require("./lib/session-store");
module.exports = function createApp({
  db,
  store,
  sessionSecret,
  origins,
  production = false,
  recoveryMailer,
} = {}) {
  if (!db) db = require("./config/supabase")();
  const secret = sessionSecret || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  const allowedOrigins =
    origins ||
    (
      process.env.FRONTEND_ORIGINS ||
      "http://localhost:5000,http://127.0.0.1:5000,http://localhost:4173,http://127.0.0.1:4173"
    ).split(",");
  const app = express();
  app.locals.db = db;
  app.locals.recoveryMailer = recoveryMailer;
  app.locals.recoverySecret = secret;
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "style-src": [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
        },
      },
    }),
  );
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && !allowedOrigins.includes(origin))
      return next(new HttpError(403, "Origin is not allowed."));
    next();
  });
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: "256kb" }));
  app.use(
    session({
      name: "hope.sid",
      secret,
      resave: false,
      saveUninitialized: false,
      store: store || new SupabaseSessionStore(db),
      cookie: {
        secure: production,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 86400000,
      },
    }),
  );
  app.get("/api/health", async (req, res) => {
    try {
      const { error } = await db
        .from("users")
        .select("id", { head: true, count: "exact" });
      if (error) throw error;
      res.json({ status: "success", database: "supabase", connected: true });
    } catch {
      res
        .status(503)
        .json({ status: "error", database: "supabase", connected: false });
    }
  });
  app.use(
    "/account",
    express.static(require("node:path").join(__dirname, "../public")),
  );
  app.get(["/set-password", "/reset-password"], (req, res) =>
    res.sendFile(
      require("node:path").join(__dirname, "../public/password.html"),
    ),
  );
  app.use("/api/auth", require("./routes/auth.routes"));
  app.use("/api/admin", require("./routes/admin.routes"));
  app.use("/api/reports", require("./routes/report.routes"));
  app.use("/api", require("./routes/ui.routes"));
  app.use("/api", require("./routes/erp.routes"));
  app.use(
    "/UI-UX",
    express.static(require("node:path").join(__dirname, "../UI-UX")),
  );
  app.get("/", (req, res) => res.redirect("/UI-UX/index.html"));
  app.use((req, res) =>
    res.status(404).json({ status: "error", message: "Route not found." }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || 500;
    if (status >= 500) console.error("Request failed:", err.code || err.name);
    res.status(status).json({
      status: "error",
      ...(err.field ? { field: err.field } : {}),
      message:
        status >= 500 && !(err instanceof HttpError && err.expose === true)
          ? "The server could not complete the request."
          : err.message,
    });
  });
  return app;
};
