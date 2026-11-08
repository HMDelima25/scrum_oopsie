# HOPE, Inc. frontend

This is the current local frontend, with the original HOPE branding, SVG icons, compact/expanded sidebar, responsive layouts and dashboard composition restored. It includes persistent workspace navigation, connected authentication/forms, record links, automatic-code previews and table search/filter/sort controls.

## Backend dependency

This change publishes frontend files only. The matching Express/Supabase backend, routes, migrations, server configuration and credentials are maintained separately and are not included in this PR. The older backend on `main` does not yet provide the full contract required by this frontend. Use the paired, configured backend for a working app; opening these HTML files directly is not an integration test.

Serve `UI-UX/` at `/UI-UX/`, serve the password-page assets in `public/` at `/account/`, and expose the password page at `/set-password` and `/reset-password`. The configured local Google origin is `http://localhost:5000`.

The frontend uses same-origin `/api/auth/*`, `/api/ui-bootstrap`, `/api/ui-schema`, `/api/ui-dashboard-data`, `/api/next-code/*`, `/api/lookups/*`, `/api/sale-price`, resource CRUD, `/api/reports/*` and `/api/admin/*` endpoints. All account approval, authorization, validation, persistence and code allocation must remain enforced by the backend. No Supabase private key belongs in browser code.

## Active entry scripts

- Authentication: `shared/utilities/live-auth.js`.
- Dashboard: `shared/utilities/dashboard-live.js`, then `modules/dashboard/dashboard.js`.
- Other modules: `shared/utilities/live-admin.js`.
- Persistent navigation: `shared/utilities/navigation.js`.
- Password setup/reset: `public/password.js`.

The older fixture scripts remain as preserved design references; connected entry pages do not load their sample records. Table updates refresh automatically, and transient read failures retry without introducing a Refresh button.
