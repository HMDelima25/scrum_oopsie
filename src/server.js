require("dotenv").config({ quiet: true });
const app = require("./app")({
  production: process.env.NODE_ENV === "production",
});
const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || "127.0.0.1";
const server = app.listen(port, host, () =>
  console.log(`HOPE backend listening on http://${host}:${port}`),
);
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
