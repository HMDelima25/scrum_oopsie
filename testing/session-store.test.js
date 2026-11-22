const { test } = require("node:test");
const assert = require("node:assert/strict");
const SessionStore = require("../backend/src/lib/session-store");
const { check, HttpError } = require("../backend/src/lib/http");

test("database errors retain safe codes for server logs without leaking details", () => {
  assert.throws(
    () =>
      check({
        error: { code: "PGRST202", message: "private database detail" },
      }),
    (error) =>
      error instanceof HttpError &&
      error.name === "HttpError" &&
      error.code === "PGRST202" &&
      error.message === "Database operation failed.",
  );
});

test("session storage errors preserve safe provider codes without leaking messages", async () => {
  const db = {
    from: () => ({
      upsert: async () => ({
        error: { code: "PGRST204", message: "private database detail" },
      }),
    }),
  };
  const store = new SessionStore(db);

  await new Promise((resolve) => {
    store.set("session-id", { cookie: {} }, (error) => {
      assert.equal(error.code, "PGRST204");
      assert.equal(error.message, "Session storage unavailable.");
      assert.ok(!error.message.includes("private database detail"));
      resolve();
    });
  });
});
