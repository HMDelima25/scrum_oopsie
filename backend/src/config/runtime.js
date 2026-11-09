function runtime(env = process.env) {
  const render = env.RENDER === "true";
  const production = render || env.NODE_ENV === "production";
  const appUrl = env.APP_URL || env.RENDER_EXTERNAL_URL || "http://localhost:5000";
  const url = new URL(appUrl);
  if (render && url.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS on Render, or leave it unset to use RENDER_EXTERNAL_URL.");
  }
  const origins = (env.FRONTEND_ORIGINS || (render ? url.origin :
    "http://localhost:5000,http://127.0.0.1:5000,http://localhost:4173,http://127.0.0.1:4173"))
    .split(",").map(value => new URL(value.trim()).origin);
  const port = Number(env.PORT || (render ? 10000 : 5000));
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT is invalid.");
  return {
    production, appUrl: url.origin, origins, port,
    host: env.HOST || (render ? "0.0.0.0" : "127.0.0.1"),
    trustProxy: env.TRUST_PROXY === "1" || (render && env.TRUST_PROXY !== "0"),
  };
}
module.exports = runtime;
