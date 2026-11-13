# S1-TST-03 — User Management cases and results

Session: 2026-11-08 to 2026-11-09, Asia/Manila. All data was disposable. Christian Ramos remains the assigned tester; Codex executed the checks for Natalia, without claiming Christian's sign-off.

| Case | Role / steps | Expected | Actual / result | Evidence |
| --- | --- | --- | --- | --- |
| UM-01 | Superadmin signs in and opens Users | All account types/statuses visible | PASS; six initial fixtures | Agent-operated browser and S1-UM-02 |
| UM-02 | Superadmin adds QA Manual Added with a synthetic email | Pending account, no silently assigned password | PASS | Agent-operated form and resulting table |
| UM-03 | Superadmin edits QA Pending User to Approved/Admin | Approved Admin account | PASS | Agent-operated form; S1-UM-02 |
| UM-04 | Admin opens Users | Privileged accounts hidden | PASS; original and newly promoted Admin rows and Superadmin absent | [Admin Users](evidence/manual-admin-users.png), S1-UM-01 |
| UM-05 | Admin edits QA Managed User's name only | Ordinary permitted edit saves | PASS; row becomes QA Managed Edited | Agent-operated form; S1-UM-03 |
| UM-06 | Admin blocks the managed User | Status becomes blocked | PASS | Agent-operated form; browser-run API assertions |
| UM-07 | Admin chooses Approved to unblock that User | Existing authorized User regains access | FAIL: Superadmin approval required | [Failure screenshot](evidence/manual-admin-unblock-failure.png), BUG-SP1-001 |
| UM-08 | Admin requests privileged account rights or promotes User | Server denies both | PASS, 403 | Automated S1-UM-01 and hierarchy tests |
| UM-09 | Attempt to disable last active Superadmin | Database prevents removal | PASS | Browser-run API assertion and backend guard tests |
| UM-10 | Ordinary User signs in | Current temporary confirmation appears | PASS current behavior; original workspace criterion remains deferred | [User prompt](evidence/manual-user-temporary-workspace.png), S1-USER-01 |
| UM-11 | User opens permitted Customers module | Read only; no Add/Edit/Make inactive or User Management link | PASS | [Read-only table](evidence/manual-user-readonly-customers.png), matrix tests |
| UM-12 | Pending/blocked fixtures sign in | Clear notice; no session | PASS | Two automated browser cases and account tests |

## Repeat the agent-operated manual session

Run `npm run test:browser:serve`, then open `http://127.0.0.1:5179/UI-UX/index.html`. Synthetic usernames and the test-only credential are in `test/browser/fixtures.js`. Stop the server to discard its database. Automated tests reset fixtures before each case; the manual session retains only its own synthetic edits until shutdown.

Manual checks cover role-specific controls and representative operations. Complete per-action server coverage is documented in [38-permission-matrix.md](38-permission-matrix.md); it is not represented as manually clicking all 41 rights under every role.

## Acceptance decision

Admin unblock remains unmet. Do not close #37 as fully accepted while BUG-SP1-001 is open. The last-Superadmin guard was exercised only in an isolated fixture, never by disabling a live teammate. Human review and original-main integration remain pending.
