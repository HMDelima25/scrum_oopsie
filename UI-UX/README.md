# HOPE, Inc. frontend

This is the current local frontend, with the original HOPE branding, SVG icons, compact/expanded sidebar, responsive layouts and dashboard composition restored. It includes persistent workspace navigation, connected authentication/forms, record links, automatic-code previews and compact icon controls for table search, filtering, sorting and grouping.

## Backend dependency

The Express/Supabase backend and the frontend are maintained in this repository. Apply the migrations in `db/migrations/` before starting the API. Opening HTML files directly is not an integration test; serve them with the backend or a local static server.

Run `npm install`, configure the server-only variables in `.env` from `.env.example`, apply database migrations, then run `npm start`. Express serves the frontend under `/UI-UX/` and at the root, and serves `/set-password` and `/reset-password` as reset-page aliases. SMTP is required outside development for account setup and password-recovery email delivery.

The frontend uses `/api/auth/*`, `/api/ui-bootstrap`, `/api/ui-schema`, `/api/ui-dashboard-data`, `/api/dashboard`, `/api/next-code/*`, `/api/lookups/*`, `/api/sale-price`, resource CRUD, `/api/reports/*` and `/api/admin/*` endpoints. The API accepts same-origin requests by default and supports local development origins listed in `FRONTEND_ORIGINS`. Never place a Supabase service-role key in browser code.

## Active entry scripts

- Authentication: `script.js` (the active sign-in page entry point).
- Dashboard: `shared/utilities/dashboard-live.js`, then `modules/dashboard/dashboard.js`.
- Other modules: `shared/utilities/live-admin.js`.
- Persistent navigation: `shared/utilities/navigation.js`.
- Password setup/reset: `reset-password.js`.

The older fixture scripts remain as preserved design references; connected entry pages do not load their sample records. Table updates refresh automatically, and transient read failures retry without introducing a Refresh button.

## Roles and permissions

User Management includes Users and Roles. Add/Edit role persists a named User permission bundle with all 41 catalogue checkboxes, module view gates, Select all and Clear. Open a User record and choose Assign rights to select a saved role or customize that User individually. Named-role checkboxes are read-only during assignment. Inactive roles revoke their grants; pending accounts still need Superadmin approval. The three system roles (Superadmin, Admin, User) remain separate from these bundles.

The backend provides GET/POST `/api/admin/roles`, GET/PUT `/api/admin/roles/:id`, PUT `/api/admin/users/:id/permission-role`, plus rights and catalogue endpoints. Role and assignment saves use record versions through `If-Match`. Lists and reports return current `{role, rights}` in `access`, allowing open screens to update navigation and actions when grants change. Authorization and propagation to assigned Users are enforced server-side.

## Frontend grouping checks

Run `node --test UI-UX/tests/table-groups.test.js`. These checks use Node built-ins and verify row-action indexes, null/date/employee group values, numeric ordering, full-page collection and cancellation without requiring the backend.
