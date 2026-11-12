# Main / Natalia branch reconciliation — 13 November 2026

This branch merges original repository main at `990d7ba`. It does not merge the pull request into main, change a teammate branch, deploy Render or write to Supabase.

## Active application

- Keep the organized `frontend/`, `backend/`, `database/`, `testing/` project, existing UI, session/OAuth protections, role permissions, audit attribution, HR lifecycle, price history and table controls.
- Include the local six-digit registration email verification work. A correct code creates a pending User; delivery or verification failure cannot enter the approval queue.
- Keep main's dependency updates for Supabase and Nodemailer and regenerate one lockfile. Keep application startup, diagnostics and isolated tests.
- Preserve original main's schema/permission catalogue and grouping tests in `testing/upstream-main/`, run through `npm test`. They exercise their original contract; application integration tests exercise the current contract.
- Preserve all incoming main issue reports, mockups and retrospective at `.documentation/team-main/`, including original names and credits. They are historical material; their old commands and paths are not the startup instructions for this organized application.
- Preserve the alternate main source implementation byte-for-byte in `.files/reference/main-990d7ba-source.zip`, with file hashes. This avoids two apparent live frontends/backends while retaining the code for review. It is not loaded by npm start or served publicly.

## Configuration and database

The backend accepts either `SUPABASE_SECRET_KEY` or the team's `SUPABASE_SERVICE_ROLE_KEY`; configure only one. Root `.env` stays private. Use `SMTP_PASSWORD` with the active mailer, rather than the archived `SMTP_PASS` name. Google login configuration and Gmail sender authorization are separate.

Main's older SQL and this application's SQL both create employee/customer/users and other tables, but use different role/session/audit structures (`app_sessions` versus `app_session`, `app_audit_events` versus `audit_log`). They cannot safely be concatenated into one migration chain. Main's alternate SQL is preserved in the source archive and is not executed alongside `database/migrations/`. Respect main's deletion of the unrelated November 2 team/project migrations and its deletion of automatic migration workflows.

No automatic SQL deployment is reintroduced. Existing live databases need an owner-reviewed baseline/upgrade; do not replay the base migration over existing tables. The isolated tests rebuild this application's schema from scratch. Before enabling the new registration flow live, apply `20261110001900_registration_email_verification.sql` and authorize the Gmail HTTPS sender on Render Free, which blocks SMTP.

## Review and deployment

PR #83 targets HMDelima25/scrum_oopsie main. The merge commit resolves its Git conflicts but does not approve/merge the PR. Render stays configured for original main and must wait for the reviewed PR and database/email prerequisites. Existing documented expected browser failures remain tracked in the Sprint 1 bug register.

## Validation of the resolved merge

- Clean dependency installation with `npm ci --ignore-scripts` succeeded.
- Full `npm test`: 193 passed, including five tests retained from original main.
- Additional repository layout HTTP check: 1 passed. It verifies the current login page and compatibility redirect, and denies access to private source, SQL, .env, documentation and the reference archive.
- Full browser run: 12 actual passes, 4 documented expected failures, 0 unexpected failures. These existing failures remain in `.documentation/testing/sprint1/40-bug-register.md`; they were not introduced or silently marked fixed by this merge.
- All 81 archived source files matched original main byte-for-byte; manifest and archive digest verified.
- No unresolved merge entries or whitespace errors; private local .env values are absent from tracked files and the archive.
- No live database migration, email delivery, Render deployment or PR merge was performed.
