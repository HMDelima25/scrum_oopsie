# Sprint 1 QA package

Prepared for the original repository's tester tasks [#35](https://github.com/HMDelima25/scrum_oopsie/issues/35), [#37](https://github.com/HMDelima25/scrum_oopsie/issues/37), [#38](https://github.com/HMDelima25/scrum_oopsie/issues/38), [#39](https://github.com/HMDelima25/scrum_oopsie/issues/39) and [#40](https://github.com/HMDelima25/scrum_oopsie/issues/40). This package tests the fork's connected implementation, not the original main branch's different database schema.

| Deliverable | Document |
| --- | --- |
| Scope, environment, approach, entry/exit criteria | [35-test-plan.md](35-test-plan.md) |
| Story-level acceptance and remaining gaps | [acceptance-checklist.md](acceptance-checklist.md) |
| User Management cases and results | [37-user-management.md](37-user-management.md) |
| Three-role permission matrix and results | [38-permission-matrix.md](38-permission-matrix.md) |
| Reproducible browser smoke runner | [39-browser-smoke.md](39-browser-smoke.md) |
| Reproduction steps, fixes and verification | [40-bug-register.md](40-bug-register.md) |
| Recorded execution and review state | [execution-record.md](execution-record.md) |

Run from the repository root:

```powershell
npm ci
npx playwright install chromium
npm test
npm run test:browser
npm run test:browser:report
```

The browser runner starts its own loopback-only server on port 5179 with a disposable PGlite database. It does not load `.env`, contact Supabase, email real people or alter the live team accounts. Port 5179 must be available. Test accounts are synthetic; their fixture credential is not a production password.

The browser summary distinguishes actual passes, known expected failures and unexpected failures. A successful process exit means there are no **unexpected regressions**. It does not mean every upstream acceptance criterion is met. See the acceptance checklist and bug register before approval.

Christian Ramos remains the assigned tester. Agent-executed browser checks are recorded as such, not as Christian's sign-off. Teammate review, one scoped PR per upstream task, and merge to original main remain pending. No issue was closed or teammate review fabricated.
