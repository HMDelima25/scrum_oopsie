const router = require("express").Router();
const c = require("../controllers/auth.controller");
const { wrap } = require("../lib/http");
const { requireUser } = require("../middleware/auth.middleware");
// Bound memory and time window for login/reset abuse; session data lives in Postgres.
const buckets = new Map();
function limit(req, res, next) {
  const now = Date.now();
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
  }
  if (buckets.size > 10000)
    return res
      .status(429)
      .json({ status: "error", message: "Try again later." });
  const key = req.ip;
  let bucket = buckets.get(key);
  if (!bucket || bucket.until < now) {
    bucket = { count: 0, until: now + 900000 };
    buckets.set(key, bucket);
  }
  if (++bucket.count > 30) {
    res.set("Retry-After", String(Math.ceil((bucket.until - now) / 1000)));
    return res.status(429).json({
      status: "error",
      message: "Too many requests. Try again later.",
    });
  }
  next();
}
router.post("/register", limit, wrap(c.registerUser));
router.post("/login", limit, wrap(c.loginUser));
router.post("/logout", wrap(c.logoutUser));
const recovery = require('../lib/recovery');
router.post("/forgot-password", limit, wrap(recovery.requestCode));
router.post('/verify-recovery-code', limit, wrap(recovery.verifyCode));
router.post('/change-recovered-password', limit, wrap(recovery.changePassword));
router.post("/reset-password", limit, wrap(c.resetPassword));
router.post("/set-password", limit, wrap(c.resetPassword));
router.get("/methods", (req, res) =>
  res.json({
    status: "success",
    data: {
      email: true,
      username: true,
      google: process.env.GOOGLE_OAUTH_ENABLED === "true",
    },
  }),
);
router.get("/google", limit, wrap(require("../lib/oauth").googleStart));
router.get(
  "/google/callback",
  limit,
  wrap(require("../lib/oauth").googleCallback),
);
router.get("/me", requireUser, wrap(c.getMe));
module.exports = router;
