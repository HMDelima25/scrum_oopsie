const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const result = spawnSync(
  process.execPath,
  [require.resolve("@playwright/test/cli"), "test", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
try {
  const report = JSON.parse(
    fs.readFileSync("test-results/browser-results.json", "utf8"),
  );
  const summary = {
    passed: 0,
    knownExpectedFailures: 0,
    unexpected: 0,
    skipped: 0,
    cases: [],
  };
  function walk(suite) {
    for (const spec of suite.specs || [])
      for (const test of spec.tests || []) {
        const actual = test.results.at(-1)?.status || "missing",
          expected = test.expectedStatus;
        const outcome =
          actual === "skipped"
            ? "skipped"
            : actual === "passed" && expected === "passed"
              ? "passed"
              : actual === "failed" && expected === "failed"
                ? "knownExpectedFailures"
                : "unexpected";
        summary[outcome]++;
        summary.cases.push({ name: spec.title, actual, expected, outcome });
      }
    for (const child of suite.suites || []) walk(child);
  }
  for (const suite of report.suites || []) walk(suite);
  fs.writeFileSync(
    "test-results/browser-summary.json",
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(
    `Browser outcomes: ${summary.passed} passed; ${summary.knownExpectedFailures} known expected failures; ${summary.unexpected} unexpected; ${summary.skipped} skipped.`,
  );
} catch {
  console.error("Browser result summary unavailable.");
}
process.exitCode = result.status ?? 1;
