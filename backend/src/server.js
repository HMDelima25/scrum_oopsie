require("dotenv").config({ quiet: true });
const runtime = require("./config/runtime")();
if (runtime.production) process.env.NODE_ENV = "production";
process.env.APP_URL = runtime.appUrl;
const app = require("./app")({
  production: runtime.production,
  origins: runtime.origins,
});
const { port, host } = runtime;
const server = app.listen(port, host, () =>
  console.log(`HOPE backend listening on http://${host}:${port}`),
);
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  // Render normally allows 30 seconds; drain in-flight requests before that.
  const deadline = setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 25000);
  deadline.unref();
  server.close(() => {
    clearTimeout(deadline);
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
