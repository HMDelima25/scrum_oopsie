const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("application source and documentation contain valid UTF-8 without garbled text", () => {
  const root = path.resolve(__dirname, "..");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const extensions = new Set([".js", ".css", ".html", ".json", ".md"]);
  const failures = [];
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) inspect(file);
      else if (extensions.has(path.extname(file))) {
        try {
          const text = decoder.decode(fs.readFileSync(file));
          // Unicode replacement characters and characteristic double-decoding sequences.
          if (/\uFFFD|\u00E2\u20AC|\u00C3\u00A9|\u00C3\u2014|\u00F0\u0178/.test(text)) {
            failures.push(path.relative(root, file) + ": garbled characters");
          }
        } catch {
          failures.push(path.relative(root, file) + ": invalid UTF-8");
        }
      }
    }
  }
  for (const folder of ["frontend", "backend", ".documentation"]) inspect(path.join(root, folder));
  assert.deepEqual(failures, []);
});
