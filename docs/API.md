# HOPE backend API

Base URL: `http://127.0.0.1:5000`. JSON responses use `{status:"success",data:...}` or `{status:"error",message:...}`. Send JSON with `Content-Type: application/json` and include the session cookie. Foreign browser origins are rejected unless listed in `FRONTEND_ORIGINS`; cookies are HTTP-only and SameSite Lax.

## Account endpoints

| Method/path                    | Input                                                                                                 | Behavior                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| POST /api/auth/register        | `{firstName,lastName,email}` or `{name,email}`; optional `username` and `password` (required by the signup UI) | Always pending User; no public role/status assignment                                          |
| POST /api/auth/login           | `{identifier,password}` (email or username; legacy email accepted)                                                                                    | Establishes a regenerated session only for approved accounts with a valid existing hash        |
| POST /api/auth/logout          | none                                                                                                  | Ends persisted session                                                                         |
| GET /api/auth/me               | none                                                                                                  | Fresh account profile/rights; 401 on expired/revoked/blocked session                           |
| POST /api/auth/forgot-password | `{email}`                                                                                             | Send six-digit email code; neutral account lookup response; missing SMTP returns 503 |
| POST /api/auth/verify-recovery-code | `{code}` (six numeric digits) | Five attempts; creates a session-bound password grant |
| POST /api/auth/change-recovered-password | `{newPassword,confirmPassword}` | Requires verified grant; changes password once without approving the account |
| POST /api/auth/set-password    | `{token,newPassword}`                                                                                 | Consumes unexpired one-time setup/reset token                                                  |
| POST /api/auth/reset-password  | `{token,newPassword}`                                                                                 | Same atomic token/password processing                                                          |

New passwords must contain at least 12 characters, uppercase and lowercase letters, a number and a symbol, and at most 72 UTF-8 bytes (bcrypt limit). Existing login passwords are still accepted. Public registration/login/reset requests are rate-limited. Forgot password sends codes, never links. Setup and legacy tokens live in the link fragment; the password page removes the fragment and sends the token in the JSON request body. First passwords are never silently assigned during login.

## Administration

All administration routes require an authenticated Admin/Superadmin before route handling, including both rights endpoints. Admin sees/manages Users only; Superadmin can approve Users and designate Admins. User self-edit through this management surface is refused. The last approved Superadmin cannot be blocked/demoted/deleted by the database guard.

| Method/path                       | Input/result                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET /api/admin/users              | Up to 500 non-deleted user profiles; password/token material excluded                                                  |
| POST /api/admin/users             | `{name,email,role?}`; pending account without a password; role User or Admin (Superadmin only for Admin designation)   |
| PUT /api/admin/users/:id          | `{name?,email?,role?,status?}`; Superadmin-only role assignment/approval                                               |
| PATCH /api/admin/users/:id/status | `{status:"approved"\|"blocked"}`; Admin may unblock an existing blocked User but cannot approve a pending registration |
| POST /api/admin/users/:id/invite  | Delivers first-password setup link for an approved account                                                             |
| GET /api/admin/users/:id/rights   | Current dotted boolean rights object                                                                                   |
| PUT /api/admin/users/:id/rights   | `{rights:{"customers.view":true,"customers.add":true,...}}`; unknown/non-boolean rights rejected                       |
| GET /api/admin/rights-catalogue   | Complete 36-action + five-view-gate dictionary                                                                         |
| GET /api/admin/audit-log          | Superadmin only, latest 200 audit records                                                                              |
| GET /api/admin/settings           | Superadmin only                                                                                                        |
| PUT /api/admin/settings/:key      | Superadmin only; `{value:"text"}` for company_name, company_address or report_footer                                   |

Rights changes update the normalized permission table and user audit record in the same transaction. They become effective on the next authenticated request. Failed audit writes roll back the corresponding user mutation.

## Business resources

Every resource below supports `GET /api/:resource`, `GET /api/:resource/:key`, `POST /api/:resource`, `PATCH /api/:resource/:key`, `DELETE /api/:resource/:key` (soft delete), and `POST /api/:resource/:key/restore`.

List parameters: `limit` (1–200, default 50), `offset`, and `status=active|inactive|all` for administrators. Ordinary Users always receive active rows only. Primary-key query parameters can narrow lists, for example `/api/prices?prodcode=TEST01`. Composite URL keys join their components with `~` in the order shown. Primary keys and system stamp/status fields are immutable through ordinary edit payloads.

| Resource     | Key                   | Writable data fields                                             |
| ------------ | --------------------- | ---------------------------------------------------------------- |
| customers    | custno                | custno, custname, address, payterm (COD/30D/45D)                 |
| products     | prodcode              | prodcode, description, unit (pc/ea/mtr/pkg/ltr)                  |
| prices       | effdate~prodcode      | effdate, prodcode, unitprice                                     |
| employees    | empno                 | empno, lastname, firstname, gender, birthdate, hiredate, sepdate |
| departments  | deptcode              | deptcode, deptname                                               |
| jobs         | jobcode               | jobcode, jobdesc                                                 |
| job-history  | empno~jobcode~effdate | empno, jobcode, effdate, salary, deptcode                        |
| sales        | transno               | salesdate, custno, empno; create also requires lines             |
| sale-details | transno~prodcode      | transno, prodcode, quantity                                      |
| payments     | orno                  | orno, paydate, amount, transno                                   |

Dates use `YYYY-MM-DD`; field lengths/natural-key formats and allowed values follow the reference SQL. The transaction number is generated by the server. Example sale creation:

```json
{
  "salesdate": "2026-11-07",
  "custno": "C0001",
  "empno": "00001",
  "lines": [{ "prodcode": "AK0001", "quantity": 2 }]
}
```

Referenced customer/employee/product/price records must already exist and be active. Header and all lines commit or roll back together. Sales requires `sales.add` and `sales.detailAdd`, plus `sales.view`. Payment mutations currently use the Sales add/edit/delete rights because the professor's 36-action catalogue has no separate Payment rights; no extra rights were invented.

Most reads require the module view gate. Job history additionally requires `hr.jhView`; sale detail additionally requires `sales.detailView`. Each write requires its matching reference action. Restore uses the same action as delete. Superadmin bypasses module/action checks; other roles require effective rights. Normal User mutation responses and lists exclude administrative stamps and soft-delete flags.

`GET /api/dashboard` returns permitted module keys, non-deleted record counts for granted modules, and role-appropriate administration links. It does not invent sales charts or seed totals.

## Reports

`GET /api/reports/:report` requires `reports.view` and the report's named right. Optional `from`, `to` and `top` filters apply to sales-based reports; `top` is bounded to 1–100 (default 10). Employee Job History requires `employee=empno` and supports effective-date bounds. Other report types ignore irrelevant date/Top N filters.

| Route suffix         | Right                   | Result                                                    |
| -------------------- | ----------------------- | --------------------------------------------------------- |
| top-customers        | reports.topCustomers    | Customer totals ranked by sales                           |
| product-master-list  | reports.productMaster   | Active products and latest effective price                |
| top-products         | reports.topProducts     | Product quantities and sales totals                       |
| active-employees     | reports.activeEmployees | Non-deleted employees hired and not separated as of today |
| all-employees        | reports.allEmployees    | All non-deleted employees, including separated employees  |
| employee-job-history | reports.empJobHistory   | Selected employee's dated job/department/salary history   |
| top-sales            | reports.topSales        | Transaction totals, payments and balances                 |

Reports return JSON; printing and PDF presentation are frontend responsibilities. Missing effective sale prices produce a clear calculation error rather than a misleading zero. No report fixtures are returned when business tables are empty.

## Live Admin support

- `GET /api/ui-schema`: authenticated field/resource metadata, labels, lengths, enums and related-record mappings.
- `GET /api/lookups/:resource?for=:purpose&offset=0`: purpose-scoped active-record choices, two hundred per page. The caller needs the relevant action right for the target form.
- `GET /api/sale-price?product=:code&date=YYYY-MM-DD`: effective stored price for a sale line, or null when no price applies.
- Admin edit/soft-delete/restore requests include an `If-Match` header containing a JSON-quoted `updated_at` value. A changed record returns 409 without applying the stale draft. Existing clients without that header retain their previous behavior.

Product lists additionally return `current_price` and `price_effective_date`; sales lists include `total`, `paid` and `balance`. System-generated primary keys such as transaction number are included in responses but cannot be assigned by ordinary edit forms.

Google routes: `GET /api/auth/methods` reports enabled sign-in methods; `GET /api/auth/google` starts server-side PKCE, `?link=1` requires an authenticated matching-email account, and `GET /api/auth/google/callback` verifies the provider identity before creating an application session. Google identity does not bypass application approval.

## Related record filters and cell destinations

`GET /api/ui-schema` includes `cellLinks`, `related`, and `listFilters`, used by the existing Admin tables. Lists accept these exact-match filters in addition to primary keys: prices (`prodcode`); job-history (`empno`, `deptcode`, `jobcode`); sales (`custno`, `empno`); sale-details (`transno`, `prodcode`); payments (`transno`). Counts and pagination apply after filtering. Destination read permissions and active-record restrictions remain enforced on every request; malformed repeated filters return 400.

Admin workspace URLs accept `view=<resource>` plus `record=<primary-key>` for a record dialog or an allowed filter field for a related list. Composite keys retain the existing tilde separator. Cell links preserve the application frame, support keyboard activation and normal new-tab behavior, and do not turn status or audit text into arbitrary destinations.

## Automatic record codes

`GET /api/next-code/:resource?prefix=AD` returns the next code preview and existing prefix choices, subject to Add permission. Customer/company IDs use C plus 4 digits; employee IDs use 5 digits and continue the reference data�s odd-number sequence; sales use TR plus 6 digits; receipts use OR plus 6 digits. Products, departments and jobs use a selected existing prefix with a numeric suffix, respecting their 6/3/4-character column limits. Alphabetic-only department/job reference codes contribute a prefix shortened only as needed to leave room for a number.

Omit the generated primary key when creating customers, employees, products, departments, jobs or payments. Prefix-based records accept `_code_prefix` metadata, which is removed before ordinary column validation. The database allocates the actual ID and inserts/audits the record in the same transaction. Explicit IDs remain supported for existing import/API clients; forms use automatic IDs. Sales headers receive their ID within the existing atomic sale-and-lines transaction. Previews do not reserve numbers; another save can change the final assigned number. Inactive IDs are never reused, exhausted column ranges fail clearly, and counters use row locks to serialize concurrent allocation.

Price history, sale details and job history retain their existing foreign/composite keys. Account UUIDs remain database-generated. Migration `20261107000500_automatic_codes.sql` is applied live; `record_code_counter` has RLS and service-only access.

## Combined table query controls

Operational lists and `/api/admin/users` accept `q`, `sort`, `direction=asc|desc`, `limit`, `offset` and `status=active|inactive|all`. Server-side search, allowed table-specific filters, and sorting run before pagination/counting. Filters use `f_<field>` for select/text values and `f_<field>_from` / `f_<field>_to` for numeric/date ranges. `GET /api/ui-schema` exposes `tableFilters`. Unknown sort columns, invalid directions/choices/ranges return 400. Search expressions are quoted and values remain bound by PostgREST; hidden system columns cannot be sorted by ordinary Users. Users always receive active business records regardless of the requested status; only administrators can read inactive accounts. Report/audit table tools filter the result set loaded into the UI.
