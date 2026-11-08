# Complete local HOPE project

This branch contains the combined local frontend, Express backend, Supabase migrations and integration tests. The separate upstream frontend-only pull request does not contain this complete backend.

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and supply private server credentials. Run the migrations in `db/migrations/` in filename order against your configured Supabase project. They use forward-only changes; the configured existing project already has these migrations applied. Do not rerun them against that project.

Start with `npm start`, then open `http://localhost:5000`. Static HTML alone cannot provide the authenticated backend. Run `npm test` for isolated integration checks. `npm run verify` checks the configured live project while the server is running.

The application includes the restored HOPE interface and sidebar, persistent navigation, Google/email authentication flows, account approval, record CRUD, automatic codes, table search/filter/sort/group controls, reports, and named permission roles. See [backend setup](docs/BACKEND-SETUP.md), [API](docs/API.md), [Admin](docs/LIVE-ADMIN.md), and [roles and permissions](docs/PERMISSION-ROLES.md).

Environment secrets, installed dependencies, private invitation/reset links, runtime sessions and generated verification artifacts stay local and are not published. `.env.example` contains configuration names and placeholders only. Google sign-in requires the operator's OAuth configuration; email delivery defaults to a local outbox unless SMTP is configured. Database content is not exported by Git; the included SQL migrations provide schema and reference/sample data.

Employee job assignment and confirmed firing/archival: [employee workflow](docs/EMPLOYEE-LIFECYCLE.md).
Employee job/department columns, filtering and grouping: [employee directory](docs/EMPLOYEE-DIRECTORY.md).
Department and Job popup tabs: [HR record details](docs/HR-RECORD-TABS.md).
Job department selection and generated codes: [job departments](docs/JOB-DEPARTMENTS.md).
Product popup price updates and immutable revision history: [product prices](docs/PRODUCT-PRICE-HISTORY.md).
