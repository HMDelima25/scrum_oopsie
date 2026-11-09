# HOPE ERP database and backend setup

Configured November 7, 2026, for Supabase project `tlsqkmjrmcnlgucjniuv` (`hope-erp`, Tokyo). The database is live; the Express backend runs locally. The Admin UI is now restored and connected; see [Live Admin](LIVE-ADMIN.md). No public hosting deployment, GitHub secret update or merge was performed.

## Start and verify

### Running a fresh clone on another computer

The public fork contains the code, not the private `.env`. A copied `.env.example` still has a placeholder database key and cannot authenticate to Supabase.

From the repository root:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Run the copy step only if `.env` does not already exist. Configure the real `SUPABASE_URL`, a server-only `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`), and a private random `SESSION_SECRET` of at least 32 characters. Obtain authorized database credentials privately from the project owner. Never put them in browser files, GitHub, or chat. A publishable/anon key cannot run the server's account queries or session storage.

Then run:

```powershell
npm run doctor
npm start
```

Open `http://localhost:5000/UI-UX/index.html`. The diagnostic checks account columns and database-backed session access without printing keys or account records. Email/password login requires this fork's `users` and `app_session` schema; a different team database containing only `app_user` is not interchangeable. SMTP and Google OAuth are separate optional configurations and are not needed for username/password login.

Use Node.js 22 or later. Open a terminal in this checkout:

```powershell
cd 'C:\Natalia\softeng\HOPE-supabase-backend'
npm ci
npm start
```

The private `.env` is already configured here. It is ignored by Git and contains the existing Supabase server key plus a generated session secret. Do not copy that key into browser JavaScript. For another developer, copy `.env.example` to `.env` and set their server configuration privately.

Backend: `http://127.0.0.1:5000`. Health check: `GET /api/health`; it queries the database and returns 503 if unavailable. The server binds to loopback by default, so it is not publicly hosted.

In another terminal:

```powershell
npm test
npm run verify
npm audit --omit=dev
```

`npm test` uses an isolated PostgreSQL-compatible PGlite database and the real Express handlers; it never seeds the live Supabase project. A test-only PostgREST adapter translates client operations into actual PostgreSQL queries, exercising the migration, triggers and RPC functions. `npm run verify` reads all 22 live tables, invokes the seven report queries, checks backend health and anonymous-access denial, then saves `.documentation/evidence/live-verification.json`. The ignored `.env` also includes the project's publishable key for the anonymous-read probe.

## First application account

The user-requested `admin` account is approved and has the Superadmin role. Its password is stored only as a bcrypt hash; no default password is committed. The Supabase dashboard account is separate from ERP application accounts.

To create the initial ERP Superadmin, the operator runs this once, replacing the example with their own email/name:

```powershell
npm run bootstrap -- your-email@example.com "Your Full Name"
```

The CLI refuses if a Superadmin already exists. It creates an approved account without a password and issues a hashed, expiring, one-time setup token. Under the current `MAIL_DELIVERY=local` setting, the link is written to a private, Git-ignored `var/outbox/*.json` file; no email is sent. Open the link yourself and set your password. The backend's `/set-password` page submits to `/api/auth/set-password` and removes the token from the address bar. No default credentials are published.

If delivery failed after creating the account, configure delivery and run `node backend/scripts/send-setup.js your-email@example.com`. The bootstrap and send-setup scripts are privileged local operator tools; do not expose them as HTTP endpoints or run bootstrap concurrently from different machines.

Other employees register through `POST /api/auth/register`, which always creates a pending User. Superadmin approves the account through `PUT /api/admin/users/:id` with `{ "status": "approved" }`, then requests an invitation with `POST /api/admin/users/:id/invite`. Pending and blocked accounts cannot sign in. Admin can manage standard Users but cannot approve a pending registration, change roles, or manage another Admin/Superadmin.

## Email delivery

The configured local outbox supports development without inventing a sent-email success. For actual email delivery set `MAIL_DELIVERY=smtp`, `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_USER`/`SMTP_PASSWORD`, and `MAIL_FROM`, then restart the backend. SMTP credentials/domain configuration are not included in this setup. Reset/setup tokens are never returned as API debug fields or printed in logs; their hashes are stored in `user_token` and expiration/reuse is enforced atomically in Postgres.

## Schema and reference compatibility

Business fields and natural/composite keys preserve the professor's PostgreSQL reference from the Natalia branch (`4fcd3a9`, `.files/.sql/HopeDB_audit.sql.txt`). SQL identifiers fold to lowercase, so `jobHistory` becomes `jobhistory`, `priceHist` becomes `pricehist`, etc. Only table definitions, soft-delete/audit behavior and the reference rights catalogue were adapted. The professor-provided fictional reference records were imported on November 7 at Natalia’s request; see REFERENCE-IMPORT.md.

| Area                       | Tables                                                   |
| -------------------------- | -------------------------------------------------------- |
| Customers                  | customer                                                 |
| Products and price history | product, pricehist                                       |
| Human Resources            | employee, department, job, jobhistory                    |
| Sales and payments         | sales, salesdetail, payment                              |
| Accounts and access        | users, role, module, rights, user_permission, user_token, auth_identity |
| Infrastructure and audit   | app_session, app_setting, app_migration, audit_log, record_code_counter       |

The 41-entry catalogue consists of 36 action rights and five module-view gates. `users.rights` uses the professor reference's dotted identifiers, for example `customers.view` and `customers.add`. The normalized `user_permission` table is synchronized transactionally from that JSON object. A module gate must be true before its action rights take effect. Superadmin has universal access; Admin still needs explicit rights for business modules.

Business mutations use service-role-only RPC functions so actor stamps, audit records, related-row checks, and data changes share one database transaction. Sales header/detail creation is atomic and requires an effective price for every line. Transaction numbers are generated by a database sequence. The seven reports and `sales_balance`/`sales_line_value`/`product_current_price` views derive prices as of the sale date and avoid payment/detail join multiplication. A report with missing effective prices fails explicitly instead of silently reporting an incomplete total.

All 20 tables have RLS enabled; browser `anon`/`authenticated` roles have no ERP-table or privileged-RPC grants. The backend uses the existing server-only secret and enforces fresh account status, role, session version and action rights per request. Normal Users do not receive `is_deleted` or `stamp` fields. An authentication/role/status/password change invalidates old sessions; rights changes apply on the next request. Session records are persisted in Postgres, not process memory.

The original ten business tables use soft delete/restore. Active children prevent deleting a parent; new/restored children cannot reference inactive parents. Hard business deletes/truncates are blocked. Audit is append-only, with redacted user records: hashes, tokens and session contents are not copied into audit history.

## Migration handling

`database/migrations/20261107000100_hope_erp.sql` creates this ERP schema. It was applied to the empty new project using a transaction in Supabase SQL Editor and recorded in `app_migration`. Its grants are scoped to ERP objects and do not replace unrelated team/project grants if those older migrations are applied later. The follow-up `20261107000200_live_ui_versions.sql` was also applied, adding record versions and conflict checks. The account sign-in migration `20261107000300_account_signin.sql` is also applied, adding usernames and private Google identity links. All three migrations are forward-only; their down sections deliberately fail instead of pretending to undo tables containing data.

The repository's pre-existing November 2 team/project migrations and GitHub dbmate deployment workflow were retained unchanged. They were not applied to this fresh ERP project, and the repository's CI credentials have not been redirected to it. Before adopting this already-provisioned project into dbmate CI, the database owner must baseline ERP versions `20261107000100`, `20261107000200`, `20261107000300`, and `20261107000400` in dbmate's `schema_migrations` ledger and decide whether to apply the unrelated older team/project migrations. Otherwise dbmate would try to create the existing ERP tables again. Do not run a new full migration chain against the live database without that baseline check.

## Remaining integration boundaries

- The restored Admin UI uses same-origin authenticated API requests. The initial Superadmin exists; public registrations still require Superadmin approval.
- The backend is local, not deployed to Supabase Edge Functions or another public host. Production hosting needs HTTPS, an explicit trusted frontend origin, a strong private session secret, SMTP and the appropriate proxy/cookie settings.
- The report selector reads backend report data; its Print / Save as PDF control opens the browser print dialog.
- Live verification is read-only and confirms the imported business tables. Full credential/CRUD/permission/constraint scenarios ran in the isolated PostgreSQL test database, not against real employee/customer accounts.

See `API.md` for route contracts and `evidence/` for the live verification results.

## Username and Google sign-in

Use `http://localhost:5000/UI-UX/index.html` for the configured OAuth origin. Login accepts username or email and verifies the stored password before opening the workspace. Public signup saves a pending User with a hashed password; Superadmin approves it in User Management, open the user, Edit, set Account status to Approved, then Save. An invitation is only needed when an account has no password.

Google OAuth client HOPE ERP local web sign-in is configured in Google Cloud project `hope-514008` and enabled in Supabase. Private client credentials are saved in the ignored `.env` and Supabase provider configuration. Google remains in Testing mode with the two owner accounts registered as testers. The Google redirect is `https://tlsqkmjrmcnlgucjniuv.supabase.co/auth/v1/callback`; the application callback is `http://localhost:5000/api/auth/google/callback`. New Google users remain pending and receive no administrative rights. Existing email accounts must sign in first and explicitly link Google from their profile.

Email/password sign-in works independently of SMTP. Password reset and setup delivery currently use the local outbox; real email delivery still requires SMTP configuration.

Automatic code migration `20261107000500` is also applied. Include it when baselining the live database migration ledger. See API.md for formats and allocation behavior.
