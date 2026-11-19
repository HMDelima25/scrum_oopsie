# Project structure

- `frontend/login/sign-in/`: login entry markup and sign-in behavior.
- `frontend/login/create-account/`: registration form behavior, shown as a dialog within sign-in.
- `frontend/login/forgot-password/`: six-digit recovery dialog and password setup/reset page.
- `frontend/login/ui/`: shared authentication styles and original presentation script.
- `frontend/admin/`: Dashboard, User Management, Customers, Products, HR, Sales, Reports and Settings pages.
- `frontend/admin/ui/`: common Admin table/form rendering and styles.
- `frontend/shared/`: API helpers, filters, sidebar template, password dialogs, navigation and assets.
- `backend/src/`: Express app, controllers, routes, middleware and server-only helpers.
- `backend/scripts/`: setup, diagnostics and verification commands.
- `database/migrations/`: forward-only Supabase SQL migrations.
- `testing/`: automated server, frontend and browser checks with disposable fixtures.
- `.documentation/`: setup guides, feature descriptions and historical QA evidence.
- `.files/`: source requirements and reference files; not served publicly.
- `var/`: ignored runtime/private output. `node_modules/`, `test-results/` and `playwright-report/` are generated local folders.

Root `.env` remains private and ignored; `.env.example`, package files and tool configuration remain at root. Run `npm start`, `npm test` and `npm run test:browser` from root as before.

Public browser URLs remain compatible with `/UI-UX/...` through a server route map. HTML references assets under `/frontend/...`. Keep browser routes distinct from filesystem paths when editing. Registration and recovery retain their existing dialogs and styling; they have not been redesigned as separate pages.
