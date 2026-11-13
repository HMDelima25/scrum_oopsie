# S1-TST-05 — Automated browser smoke

Implementation: `playwright.config.js`, `test/browser/fixtures.js`, `test/browser/server.js`, `test/browser/sprint1.spec.js`, and `scripts/run-browser-tests.js`.

```powershell
npm ci
npx playwright install chromium
npm run test:browser
npm run test:browser:report
```

Use port 5179 exclusively for this run. The runner owns and stops its disposable server. It binds to loopback, loads no `.env`, and uses in-memory PostgreSQL fixtures. The production server has no `/_test/*` endpoints. Do not deploy the fixture server.

## Smoke acceptance

- A wrong password leaves the browser on login and `/api/auth/me` unauthenticated.
- A verified Superadmin password opens the actual dashboard with the expected identity and User Management navigation.
- Logout returns to login and a protected account request returns 401.
- Pending and blocked fixture accounts see the correct field notice and remain unauthenticated.
- The mobile-sized run reaches Customers through the persistent collapsible sidebar.
- Additional browser cases cover approval/designation, rights checkboxes, hierarchy and the temporary User confirmation.

## Reports and known failures

`playwright-report/index.html` contains the HTML report. `test-results/browser-results.json` contains raw results; `test-results/browser-summary.json` distinguishes true passes from known expected failures. Traces and screenshots are retained on failures under `test-results/artifacts`.

Four known acceptance cases are marked `test.fail` and linked to BUG-SP1-001, GAP-SP1-002, BUG-SP1-007 and BUG-SP1-008. Playwright's default console total may call expected failures passed; use the explicit wrapper summary and bug register. If a known failing case starts passing, Playwright treats that as an unexpected pass so the annotation and register must be reviewed. No retries conceal flaky failures.

The workflow `.github/workflows/sprint1-tests.yml` runs the isolated API and browser tests and uploads reports. Actual hosted CI status is separate from the recorded local run; the workflow file alone is not evidence that GitHub Actions passed.
