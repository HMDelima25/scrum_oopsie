# S1-TST-01 — Sprint 1 test plan

Date: 2026-11-08, Asia/Manila. Application baseline: `319a751`; the accompanying change adds QA assets and expands existing permission assertions. Prepared with Natalia; assigned tester/reviewer: Christian Ramos. Human review is pending.

## Objective and scope

Verify registration and approval, password authentication and logout, setup/recovery tokens, User Management, role boundaries, 36 action permissions plus five module gates, audit attribution, and login-to-workspace navigation. Check positive and negative paths. Test both visible controls and server enforcement so hiding a button cannot substitute for authorization.

In scope: US-1 registration, US-2 authentication/setup, password recovery, US-4 User Management, US-5 approval/designation, US-6 rights and US-7 role-based main-page access. The browser smoke covers desktop Chromium and a 390×844 viewport. API tests exercise actual PostgreSQL functions and triggers through PGlite.

Out of scope: load/penetration certification, real Google consent, mailbox-provider uptime, migration reconciliation with original main, public hosting, Safari/Firefox certification, and completion of the owner-deferred User workspace. Out-of-scope items are not marked passed.

## Environment and data

- Node.js 22 or later; dependencies installed using the committed lockfile.
- `npm test`: a separate PGlite database per test suite; no real Supabase configuration is required.
- `npm run test:browser`: headless Chromium, port 5179, fresh synthetic fixtures before each case. Playwright report captures failures and traces.
- Agent-operated manual browser review uses the same isolated fixture server. Evidence contains only QA accounts and fictional customer data.
- Accounts: one Superadmin, one Admin, approved Users, one pending User and one blocked User. Superadmin has fixed authority; Admin has Customer view/add; the ordinary User has Customer view only.
- Compare dates in Asia/Manila. Login activity uses database timestamps and retains name/role snapshots.

## Approach

1. Run server and database integration tests, including token expiry/reuse and last-Superadmin protection.
2. Exercise each of 41 permission entries with User and Admin denied then allowed; verify Superadmin succeeds with fixed authority. Assert the exercised set equals the rights catalogue.
3. Run browser smoke and User Management/rights-dialog scenarios. Keep known failures explicitly annotated and linked to bug IDs.
4. Perform agent-operated browser checks across three roles and record actual outcomes. Do not equate API coverage with manually checking every widget.
5. Record reproducible defects, approved requirement deviations and unresolved environment reports separately.
6. Submit for teammate review; prepare separate upstream PRs only after dependencies with original main are resolved.

## Entry criteria

- The fork's schema and fixtures load without production keys.
- Test server and browser are available; no existing process owns the test port.
- Acceptance criteria are taken from the upstream issue bodies and owner-approved behavior changes are identified.

## Exit criteria

- No unexplained automated failure; every known failing acceptance case has a bug ID and reproduction steps.
- Positive/negative authentication, User Management and 41-entry role matrix results are recorded.
- Browser smoke proves a real password check, resulting workspace, logout and protected-request denial.
- No live accounts, business data, provider credentials or session secrets are embedded in evidence.
- Remaining blocking acceptance defects are fixed or explicitly accepted by the responsible owner and reviewer.
- Christian/teammate review, task-specific PRs and original-main merge are recorded before claiming the upstream tasks closed.

## Severity and triage

Critical: unauthorized privileged access or data exposure. High: valid roles cannot perform a required account operation or approval bypass. Medium: a workflow fails while another authorized path exists. Low: presentation or documentation defect. Deferred owner-approved scope is tracked as a requirement gap, not silently converted into a pass.

Current exit decision: QA execution can complete with documented gaps; full Sprint 1 acceptance is withheld while the register's open acceptance failures and required human review remain unresolved.
