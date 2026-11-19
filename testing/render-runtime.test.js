const { test } = require("node:test");
const assert = require("node:assert/strict");
const runtime = require("../backend/src/config/runtime");
const createApp = require("../backend/src/app");
const { MemoryStore } = require("express-session");

test("Render URL, assigned port, proxy and production defaults work without local settings", () => {
  const config = runtime({ RENDER: "true", RENDER_EXTERNAL_URL: "https://school.onrender.com", PORT: "10001" });
  assert.equal(config.appUrl, "https://school.onrender.com");
  assert.deepEqual(config.origins, [config.appUrl]);
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 10001);
  assert.equal(config.production, true);
  assert.equal(config.trustProxy, true);
});
test("custom domain origins normalize whitespace and trailing slashes; local defaults remain local", () => {
  const config = runtime({ RENDER: "true", APP_URL: "https://hope.example.test/", FRONTEND_ORIGINS: " https://hope.example.test/ , https://other.example.test/ ", TRUST_PROXY: "0" });
  assert.deepEqual(config.origins, ["https://hope.example.test", "https://other.example.test"]);
  assert.equal(config.trustProxy, false);
  assert.equal(runtime({}).host, "127.0.0.1");
  assert.equal(runtime({}).production, false);
});
test("invalid Render URLs and ports fail before serving requests", () => {
  assert.throws(() => runtime({ RENDER: "true", APP_URL: "http://localhost:5000" }), /HTTPS/);
  assert.throws(() => runtime({ PORT: "not-a-port" }), /PORT/);
});

async function health(t, result) {
  const store = new MemoryStore();
  store.get = () => { throw new Error("Health must not access session storage"); };
  const db = { from: () => ({ select: () => result }) };
  const app = createApp({ db, store, sessionSecret: "health-test-secret-with-more-than-32-characters", origins: [] });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return fetch(`http://127.0.0.1:${server.address().port}/api/health`, { headers: { cookie: "hope.sid=invalid-session" } });
}
test("readiness checks database without sessions, cookies or cached results", async t => {
  const response = await health(t, Promise.resolve({ error: null }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).connected, true);
});
test("database failure returns unavailable instead of a false healthy result", async t => {
  const response = await health(t, Promise.resolve({ error: new Error("private provider details") }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "error", database: "supabase", connected: false });
});
test("unresponsive database returns before Render's five-second health deadline", async t => {
  const start = Date.now();
  const response = await health(t, new Promise(() => {}));
  assert.equal(response.status, 503);
  assert.ok(Date.now() - start < 5000);
});
