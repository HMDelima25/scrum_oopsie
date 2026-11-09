# Admin app and Supabase data

Open `http://127.0.0.1:5000/UI-UX/modules/dashboard/index.html`. The app requires an approved ERP account and redirects to sign-in when there is no session. The Supabase dashboard login is separate. The user-requested `admin` account is an approved Superadmin. New registrations remain pending until Superadmin approval.

The original ocean-blue/gold UI assets have been restored under `UI-UX/` in this backend checkout. The module entry pages now load `live-admin.js` rather than the historical fixture data/runtime. Those original files remain available as design history; they are not loaded into the connected Admin pages.

## Two-way record updates

- Add/Edit/Make inactive/Restore actions call the authenticated backend and persist to Supabase. After a successful save the table is read again; it does not display an invented success or keep a separate local data copy.
- Visible pages refresh their current records every five seconds, and again on window focus or returning to the tab. Refresh is also available manually. This is polling, not a Supabase Realtime subscription; changes made directly in the Table Editor normally appear within five seconds while the page is visible and connected.
- Database errors or loss of permission are shown in the status area. A failed refresh does not silently replace the existing table with sample values.
- The `updated_at` field is set by a database trigger for business records and users, including changes made through Supabase's Table Editor. The app sends that version when editing. The database checks and locks the record in the mutation transaction, returning HTTP 409 if it changed elsewhere. The existing form draft remains intact and offers Reload saved record.
- Foreign-key choices refresh from active database records, including while a form is open. A newly added product/customer/employee/job/department/sale becomes a choice. The current selection and typed quantities are preserved. An inactive/missing selected record is marked unavailable instead of silently replaced by another choice.

Record structure changes (adding/renaming database columns or inventing new ERP modules) still require corresponding API and UI metadata changes. This feature synchronizes record values within the defined HOPE schema, not arbitrary schema redesigns.

## Cells and forms

`GET /api/ui-schema` provides field labels, types, length limits, enum choices and resource/group mappings. Keys, writable fields and database constraints follow the professor's SQL reference. Add/Edit dialogs use that metadata; immutable/composite keys are prefilled and disabled when editing. There is no visible action column: open a row by click/Enter, or use its right-click/keyboard context menu.

Products include the current stored price and effective date. Sales include generated transaction number, calculated total, paid and balance. Sales forms look up customers, employees and products from their tables and request the effective product price for the selected sale date; line totals and the sale total update with quantity. Payments choose an actual saved sale. Job history chooses actual employees, jobs and departments. The server remains authoritative for validation, permissions, prices and persistence.

Only the reference roles and rights are offered in account management. New application users are pending, and passwords are set privately through setup links rather than entered into an Add User prompt. Public registration asks for first name, last name and email; it does not collect the historical prototype's username/birthdate/password fields. Unsupported social sign-in/recovery methods are hidden.

Lists use server pagination, fifty rows at a time. Search is explicitly labeled **Search this page**, not an all-record search. Ordinary Users see permitted modules/actions and active rows; Admin/Superadmin status filters show Active/Inactive/All. Job-history and sale-detail views require their additional read right. Report and settings forms preserve entered selections/drafts during background refresh; reports rerun their last successfully chosen filters when refreshed.

## Validation

Automated coverage includes schema/lookup contracts, purpose-scoped lookup denial, direct database edits reflected in subsequent reads, fresh/stale form versions, computed product prices and restoration of all eight module entry pages. The earlier auth/permissions/CRUD/audit/report suite remains in place.

Browser verification used an **isolated PGlite test database** with fictional records and an ephemeral test session; it never connected that fixture account to live Supabase. Checked:

- Customer values prefilled in Edit, saved, and returned to table cells.
- Direct database edits refreshed the table; an open draft stayed unchanged, displayed a conflict notice, and its stale Save was rejected.
- Sales choices included the saved customer/employee/product. Stored unit price 12.50 Ã— quantity 2 displayed 25.00. A newly inserted product appeared while the dialog stayed open, without changing the existing product/quantity.
- Saved sale/payment rows, generated transaction number, and price-history editing through its date/product composite key.
- Product/price and HR job-history dialogs on phone layout; Save/Cancel stayed inside the dialog after correcting the legacy fixed-button styling.
- The normal live app remains sign-in protected. Live verification confirmed twenty tables, two applied ERP migrations, zero application users/business fixtures, working report queries, and denied anonymous database/API access.

No representative-user study, exhaustive screen-reader audit or public hosting deployment is claimed. The real Supabase database remains empty of business records and users until the owner adds them.

## Original UI restoration â€” November 7, 2026

At Nataliaâ€™s request, restored the original dashboard markup and stylesheet from the preserved UI/UX checkout. The original brand symbol, SVG navigation icons, collapsible sidebar, profile button, dashboard tabs, metric cards and panels are retained. `dashboard-live.js` supplies authenticated, permission-checked API records to the existing dashboard rendering code; SQL fixtures are not loaded. Module navigation uses the same original sidebar markup. Existing backend forms and conflict checks remain connected. No further visual redesign is authorized without Nataliaâ€™s approval.

## Persistent navigation correction

Removed integration overrides that replaced the dark sidebar with a pale off-screen menu. Compact and expanded rails now remain available at phone widths using the original brand toggle and transition timing. Internal module links use a persistent application frame: the sidebar stays mounted, workspace content changes without document navigation, and old polling and request lifecycles stop on departure. History navigation and quick actions use the same route handler. Open dialogs retain their draft until closed.

## Connected cells

Customer, employee, product, department, job, transaction and receipt identifiers open their stored record. Product prices open that product’s price history. Sale totals open its detail lines; paid/balance cells open its payments. Read-only record dialogs also offer the relevant child lists. These use the existing record-action styling and preserve sidebar/navigation behavior. Browser verification used isolated records on port 5010; no sample business rows were added to live Supabase.

## Loading optimization

Module startup now uses `/api/ui-bootstrap` for authenticated account details, schema and the permitted first record page in one response. The same list query code serves both ordinary endpoints and bootstrap. The sidebar template is reused, and tabs within a mounted module reuse their last result while revalidating; changing tabs cancels obsolete requests. Authorization failures clear cached rows. Dashboard startup/polling uses one `/api/ui-dashboard-data` request, with server-side parallel reads, instead of separate authenticated resource requests. No account/session authorization cache was introduced.

Local live measurements: previous sequential account + schema + customer list requests totaled 2215 ms; customer bootstrap measured 749 ms, product bootstrap 875 ms, and the dashboard data response 990 ms. These are single local observations, not guaranteed response times.

## Table controls and inactive samples — November 8, 2026

Non-dashboard tables now include Filter, a column selector and an Asc/Desc toggle beside Records. Filters derive from the table: customer payment terms/address, product units, employee gender/employment/dates, transaction/customer/employee references, job/department references, and date/numeric ranges for prices, salaries, quantities and payments. Search and operational filters/sorting execute before pagination with matching total counts. Reports filter/sort their generated result; audit controls apply to the loaded recent audit set. Settings is a form and has no table controls.

Five explicitly named inactive samples were inserted into each of the ten business tables, plus five blocked/deleted sample User rows with no password. They use valid related keys and automatic ID allocation. Existing imported records and the two real accounts remain unchanged. The one-time migration is `20261108000600_inactive_samples.sql`; these sample accounts cannot sign in. Audit is immutable and receives the real 55 insertion events rather than fabricated inactive logs. Reports retain their existing active-record rules.

All business Add API routes and Add User passed integration checks; Customer and Sale were also saved through browser forms in isolated PostgreSQL (including automatic IDs and calculated prices). Live inactive endpoints all returned 200 with five matching rows each. Browser verification combined inactive products, a search term, Unit=ea, and descending codes, producing three matching rows. Transient GET transport failures are retried once, and automatic updates remain enabled. No Refresh buttons were added.

## Compact icon tools and grouping

Filter, sort-column, sort-direction and grouping are icon controls with accessible names and tooltips. Filters open a compact floating panel using existing theme tokens; reset is an icon. Group choices come from the current table’s filter/schema characteristics. Grouped operational lists collect every matching page before rendering groups, preserve original row indexes for actions, and hide ordinary page controls. Reports/audit group their loaded results. Grouping composes with status, search, filters and sort direction. Shared pure helpers in `table-groups.js` are covered for indexes, null/date/employee values, numeric ordering, full pagination and cancellation. Audit/report refreshes preserve filter controls and focus when columns have not changed.

## Add dialog sizing and actions

Shared dialogs now use a 540px compact layout, 620px standard employee/job-history layout, and 720px sale/rights layout, each constrained to the viewport. Inputs are 36px high; field alignment no longer stretches controls beside automatic-code help text. Action buttons share DM Sans at 12px/700 weight, 36px height and consistent padding; Save and Cancel have the same minimum width. Empty notices and default fieldset padding no longer inflate the form. Long dialogs scroll their body while retaining header/footer controls; hidden commands remain hidden despite flex button styling.

A browser audit opened all 11 Add dialogs in an isolated PostgreSQL-backed app: customer, product, price, employee, department, job, job history, sale, sale item, payment, and user. Every Save/Cancel pair matched in font, weight and height with no horizontal overflow. At 390x650, customer, employee, sale and user dialogs fit the viewport with visible footer actions. Evidence is in `add-dialog-audit.json` and `add-dialog-mobile-audit.json`. No live records were created during this visual audit.
