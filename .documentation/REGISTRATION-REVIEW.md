# Inline registration review

User Management displays two compact circular outline icons for an active pending registration when the viewer is a Superadmin: green check approves, red cross disapproves. Their backgrounds are transparent. Accessible labels include the account name, and keyboard activation works without opening the row's detail prompt. No action leaves the account pending.

After review, the row displays Approved or Disapproved. The account-status filter includes Pending, Approved and Disapproved; the existing Blocked state remains available for separately blocked accounts. Pending/disapproved accounts cannot sign in. A registration decision never changes the account's role or its permissions.

`POST /api/admin/users/:id/review` accepts `{decision:"approved"}` or `{decision:"disapproved"}` and requires an `If-Match` header containing the JSON-encoded `updated_at` timestamp from the listed account. Both middleware and the service-only database function enforce Superadmin authority. The database locks the pending account, validates the version, and applies a full-name audited update in one transaction. Repeated/stale decisions return 409 instead of overwriting another review.

Migration `20261109001800_registration_decisions.sql` adds the separate disapproved state and protected review function. Existing pending, approved and blocked records are preserved; the migration does not approve/disapprove any real registration.

Verification: `test/registration-decisions.test.js` covers authorization, unchanged pending state, approval, disapproval/login denial, audit attribution, stale/repeated requests, invalid input and all three filters. Browser case S1-REG-01 checks outline/transparent styling, keyboard approval, disapproval, non-opening row behavior and filtering using disposable accounts.
