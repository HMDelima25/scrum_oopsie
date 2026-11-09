> Review contribution for #35; Christian Ramos retains task ownership.
> Historical evidence below is from fork baseline `319a751`, NOT original main (`a0c7da9`). Any PASS/FAIL, commands, fixture accounts, schema or file references below describe that fork only. Re-run/adapt against original main before acceptance. This PR adds documentation only; it does not install the fork test harness or claim main is verified.

# Sprint 1 acceptance checklist

Legend: PASS = observed by the cited automated/agent-operated check; GAP = unmet or deferred; PENDING = external review or unverified environment. An automated pass is not a teammate approval.

| Requirement | Result | Evidence / limitation |
| --- | --- | --- |
| Registration creates pending User, not self-approved Admin | PASS | `test/backend.test.js`, `test/accounts.test.js` |
| Salted password hashes; login checks an existing hash | PASS | Backend/account tests and S1-SMOKE-01 |
| Pending/blocked users cannot sign in | PASS | Two browser negative-login cases and API tests |
| Logout ends the session and protected requests fail | PASS | S1-SMOKE-01 and backend tests |
| Setup/reset tokens are hashed, expiring and single-use | PASS | `test/backend.test.js`, `test/recovery.test.js` |
| All first passwords are established by a one-time setup link | GAP / owner-approved variation | Invitations support this. Public signup accepts a strong initial password and team accounts were provisioned privately as requested. Reviewer must approve the variation. |
| Repeated authentication failures are limited | PASS | Server rate limiter; not a load/security certification |
| Users table shows identity, role and status; Add/Edit controls exist | PASS | S1-UM-03 verifies the real approved-User edit form |
| Admin cannot retrieve/manage Superadmin or another Admin | PASS | S1-UM-01 and hierarchy API tests; this fork hides both privileged row types |
| Admin can block and unblock Users | GAP | Block works; unblock fails, BUG-SP1-001 |
| Superadmin can approve pending User and designate Admin | PASS | S1-UM-02 and API tests |
| Last active Superadmin cannot be disabled/demoted | PASS | Isolated database/API guard tests and browser-run API assertion |
| Rights dialog contains five module gates and 36 actions | PASS | S1-RIGHTS-01 |
| All/None and module disabling behave correctly | PASS | S1-RIGHTS-01 and agent-operated browser review |
| Rights take effect on the next protected request | PASS | Three-role matrix and named-role integration tests |
| Rights changes record the acting person's full name | PASS | Audit tests and S1-RIGHTS-01 |
| User/Admin action rights are enforced by server | PASS | All 41 catalogue entries in `test/permission-roles.test.js` |
| Superadmin fixed authority covers the same protected endpoints | PASS | Expanded three-role matrix |
| Hidden module URLs are denied by their protected APIs | PASS | Permission matrix and User browser-run request assertions |
| Ordinary User receives the complete role-based workspace after login | GAP / deferred | Owner requested a temporary success dialog; GAP-SP1-002 |
| Responsive sidebar and real login work on phone-sized viewport | PASS | S1-SMOKE-02, Chromium 390×844 |
| Groupmate's fresh clone signs in successfully | PENDING | Original report lacks diagnostic output; ENV-SP1-004 |
| Teammate review, separate task PRs and merge to original main | PENDING | Not performed by this QA package |

## Completion gates

- [x] Formal plan, cases, outcomes and bug register prepared.
- [x] API/database suite passed: 168 tests.
- [x] Browser run recorded: 9 actual passes, 4 known expected failures, zero unexpected failures.
- [x] Agent-operated checks across all three roles recorded with synthetic evidence.
- [ ] Resolve or formally accept the open acceptance gaps and UI defects (BUG-SP1-001, GAP-SP1-002, BUG-SP1-007, BUG-SP1-008).
- [ ] Obtain Christian/teammate review.
- [ ] Open one scoped PR per upstream task and merge to original main.

The visible Settings shortcut and denied-page JavaScript error remain UI defects even though the corresponding protected APIs deny access. See the bug register.
