> Review contribution for #40; Christian Ramos retains task ownership.
> Historical evidence below is from fork baseline `319a751`, NOT original main (`a0c7da9`). Any PASS/FAIL, commands, fixture accounts, schema or file references below describe that fork only. Re-run/adapt against original main before acceptance. This PR adds documentation only; it does not install the fork test harness or claim main is verified.

# S1-TST-06 — Bug and verification register

Application baseline: `319a751`. No upstream issue is closed by this register. Reproduction uses synthetic fixtures unless explicitly marked an external report.

| ID | Severity / state | Related issue | Summary |
| --- | --- | --- | --- |
| BUG-SP1-001 | High — OPEN | #37 | Admin cannot unblock an existing User |
| GAP-SP1-002 | Deferred owner-approved scope | #38, #39 | Ordinary User has a temporary success dialog instead of a workspace |
| REG-SP1-003 | VERIFIED PASS | #37 | Admin approved-User edit does not submit an unnecessary approval |
| ENV-SP1-004 | NEEDS INFORMATION | #40 | Groupmate's clone returns a generic server error at login |
| REG-SP1-005 | IMPLEMENTED / regression checked | #38, #40 | Permission gates require real server enforcement, not only hidden controls |
| REG-SP1-006 | FIXED / regression checked | #40 | Username-only actors must have full-name audit attribution |
| BUG-SP1-007 | Medium — OPEN | #38 | System Settings shortcut is visible to ordinary Users |
| BUG-SP1-008 | Medium — OPEN | #38, #40 | Denied module URL shows an internal JavaScript error |

## BUG-SP1-001 — Admin unblock

Precondition: sign in as QA Admin; QA Managed User is approved.

Steps: block the User using `PATCH /api/admin/users/:id/status` with blocked status; then request approved status to unblock.

Expected: Admin restores access to an existing authorized User, without gaining authority to approve new pending registrations or manage privileged roles.

Actual: block succeeds; unblock returns 403, `Superadmin approval required.` The controller checks every approved transition as a new approval. No workaround that bypasses server authorization is used.

Verification: browser-run expected failure in `sprint1.spec.js`. Fix not implemented in this QA task. After fixing, add a regression distinguishing unblock of a previously approved User from first approval of a pending account, remove `test.fail`, and rerun the hierarchy/session tests.

## GAP-SP1-002 — User workspace

Steps: sign in with QA User's valid password.

Expected by original US-7: reach a role/right-filtered workspace.

Actual: authenticated temporary success dialog states the User workspace is still being prepared. This follows Natalia's current instruction. APIs still enforce rights; the dialog does not grant administrative access.

Verification: one passing test verifies the approved temporary behavior; a separate expected failure records the unmet original workspace criterion. Complete the workspace or obtain explicit acceptance of the revised scope before marking US-7 complete.

## REG-SP1-003 — Admin edit verification

Steps: sign in as QA Admin; open QA Managed User; click the pencil Edit icon; change only the name; leave status Approved; save.

Expected/observed: the actual form sends only the changed name and receives 200. It does not submit a new approval. A speculative unchanged-status concern was rejected by executing the real browser form; no product bug or fix is claimed.

Verification: passing S1-UM-03 browser case. Admin promotion/first approval restrictions remain covered separately.

## ENV-SP1-004 — Groupmate setup

Reported reproduction: clone the public fork on another machine, open the local login page, enter an existing account and submit. Screenshot shows `The server could not complete the request.`

Actual cause: NOT CONFIRMED. A screenshot cannot distinguish missing/incorrect private configuration, wrong schema, unavailable session storage, or network failure. Do not mark the remote report fixed based on this machine's success.

Mitigation already in code: `npm run doctor`, placeholder/publishable server-key rejection, and the fresh-clone setup guide. Local diagnostics and account tests pass. Await the groupmate's `FIX:` lines or safe terminal error. No private keys or original screenshot containing a password are published in this register.

## REG-SP1-005 — Authorization regression

Reproduction: set an action or module gate false, submit a direct protected request as User/Admin, then grant it and retry. Superadmin uses fixed authority.

Expected/observed: forbidden then allowed for User/Admin; allowed for Superadmin. All 41 entries are asserted against real database-backed endpoints. Named-role changes and revocations affect already-signed-in sessions. Verified by `test/permission-roles.test.js`; this is automated coverage, not a claim of 123 manual widget checks.

## REG-SP1-006 — Audit attribution regression

Reproduction: use an approved username-only fixture account with a full display name; create/edit a business record and inspect its stamp and audit entry.

Expected/observed: the acting full name is recorded, not the database service identity or an absent email. Verified by `test/login-activities.test.js` and the rights browser case. Historical audit entries are preserved. Login history retains the name and role at authentication time.

## BUG-SP1-007 — Settings shortcut visibility

Steps: sign in as QA User, observe the temporary confirmation, then open the allowed Customers module. Inspect the sidebar.

Expected: privileged System Settings is not offered to an ordinary User.

Actual: the Settings button remains visible and its handler routes into administration. Protected settings APIs still return 403; no settings data is exposed. This is a misleading UI affordance, not an authorization bypass.

Verification: agent-operated browser review, [User screenshot](https://github.com/riellealia/scrum_oopsie/blob/30f8ef3/docs/testing/sprint1/evidence/manual-user-readonly-customers.png), and expected-failure browser case. Fix pending. Account-profile controls should remain separate from privileged system settings.

## BUG-SP1-008 — Denied direct module URL

Steps: sign in as QA User with Customer view only, then open `/UI-UX/modules/products/index.html` directly.

Expected: a clear access-denied/no-permission state, no product records or write controls.

Actual: no product records appear, but the page shows `Cannot read properties of undefined (reading 'result')` and `Records could not be loaded.` An empty allowed-view result reaches an unguarded initial-record path. Protected product API requests still return 403.

Verification: [Denied URL screenshot](https://github.com/riellealia/scrum_oopsie/blob/30f8ef3/docs/testing/sprint1/evidence/manual-user-denied-url.png), permission matrix and expected-failure browser case. Fix pending. Downloading the static HTML shell does not provide protected data access.
