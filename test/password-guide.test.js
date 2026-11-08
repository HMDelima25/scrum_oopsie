const { test } = require("node:test");
const assert = require("node:assert/strict");
const { password } = require("../src/lib/http");
const guide = require("../public/password-guide");
test("Password guide and server enforce the same new-password rules", () => {
  const rejected = [
    "",
    "short1A!",
    "onlylowercase123!",
    "ONLYUPPERCASE123!",
    "MissingNumbers!",
    "MissingSymbol123",
    "Strong-1" + "é".repeat(40),
  ];
  for (const value of rejected) {
    assert.ok(guide.error(value));
    assert.throws(() => password(value));
  }
  for (const value of [
    "Strong-new-password-1!",
    "TwelveGood1!A",
    "Long passphrase 1! A",
  ]) {
    assert.equal(guide.error(value), "");
    assert.equal(password(value), value);
  }
});
