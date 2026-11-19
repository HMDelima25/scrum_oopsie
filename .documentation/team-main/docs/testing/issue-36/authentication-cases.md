# Authentication test cases — issue #36

Prepared as a review contribution; Christian Ramos retains task ownership. Target: original main `a0c7da9`. All cases below are **NOT RUN on main**. Use disposable, approved test accounts and a test mailbox; never commit passwords or tokens.

| ID | Procedure | Expected result |
|---|---|---|
| AUTH-01 | Submit registration without each required field; try malformed email | Field validation; no account inserted |
| AUTH-02 | Register a unique email, then repeat with changed email letter case | First account is pending/User; duplicate rejected |
| AUTH-03 | Attempt pending and blocked account login with correct password | Clear denial; no authenticated session |
| AUTH-04 | Inspect test account password storage; create two accounts with identical passwords | Salted hashes only; distinct hashes; no plaintext |
| AUTH-05 | Open a fresh first-password setup link and set a password | Setup succeeds once; password permits login after approval |
| AUTH-06 | Retry the consumed setup token; try expired and malformed tokens | All denied without password changes |
| AUTH-07 | Log in with approved account, then wrong password and unknown username | Valid login succeeds; invalid credentials do not authenticate |
| AUTH-08 | Repeat invalid logins to configured threshold | Rate limit or temporary lock; no password/token disclosure |
| AUTH-09 | Log out, then request /api/auth/me and protected records using the old cookie | Session invalidated; protected requests denied |
| AUTH-10 | Request reset for existing and unknown email | Defined privacy behavior; delivery only to registered email; no token in response |
| AUTH-11 | Reset using fresh token, then authenticate using old/new passwords | New password works; old password fails |
| AUTH-12 | Submit expired token, reused token, missing expiry and two concurrent redemptions | All invalid cases denied; at most one concurrent redemption succeeds |
| AUTH-13 | Reset to invalid password or mismatching confirmation | Validation; current password remains valid |
| AUTH-14 | Visit protected page after logout with browser Back | No usable protected session; redirect or clear login-required state |

## Execution record

For every case record main commit, migration list, browser/version, role, timestamp in Asia/Manila, expected/actual behavior, evidence reference, result and defect ID. Do not mark unexecuted cases passed. Preserve teammate review separately from agent execution.

## Current contract and review boundaries

Main currently implements link-token recovery in `src/controllers/auth.controller.js`; the fork's six-digit recovery flow is different and is not imported by this document. The requested original issue includes setup-link expiry/reuse. Confirm the application's setup route and mail configuration before testing it. Test at the API as well as the form; hidden buttons do not prove authorization. Do not use production credentials or send mail to real teammates during automated runs.
