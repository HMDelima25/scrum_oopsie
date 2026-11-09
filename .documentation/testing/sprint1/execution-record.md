# Recorded QA execution

Application baseline: `319a751`. Session: 2026-11-08 to 2026-11-09, Asia/Manila. This QA change adds fixtures, browser tests, CI and broader permission assertions. No live business data or team credentials were changed for these tests.

| Layer | Recorded outcome |
| --- | --- |
| Full server/database suite, `npm test` | 168 passed, zero failed |
| Permission catalogue | 41 entries across User, Admin and Superadmin; denied/allowed variants for User/Admin |
| Headless Chromium | 9 passed; 4 explicit known expected failures; zero unexpected failures or skips |
| Agent-operated browser review | All three roles, disposable data; actual outcomes in #37/#38 documents |
| Human tester sign-off | Pending Christian/teammate review |
| Hosted GitHub Actions | Workflow provided; hosted status is separate from local evidence |
| Upstream task PRs / original-main merge | Pending; no issue closed |

Raw browser results, traces and screenshots are generated in ignored `playwright-report` and `test-results` directories. [execution-record.json](execution-record.json) is a sanitized summary with no real accounts, keys or sessions.

Curated evidence contains only synthetic fixture data:

- [Superadmin rights editor](evidence/manual-superadmin-rights.png)
- [Admin Users visibility](evidence/manual-admin-users.png)
- [Admin unblock failure](evidence/manual-admin-unblock-failure.png)
- [Temporary User confirmation](evidence/manual-user-temporary-workspace.png)
- [Read-only Customers and visible Settings shortcut](evidence/manual-user-readonly-customers.png)
- [Denied direct URL error](evidence/manual-user-denied-url.png)

Known failures have explicit expected-failure browser cases rather than being silently skipped. A green test process does not mean the original acceptance checklist is complete.
