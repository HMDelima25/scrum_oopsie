# HOPE, Inc. ERP

A school ERP project for customers, products, human resources, sales, payments, reports, and user access. This branch contains the connected frontend, Express backend, Supabase migrations, and tests.

## Team

| Role | Team member |
| --- | --- |
| Scrum Master | DELIMA, Honey Mae D. |
| UI/UX developer | ORTIZ, NATALIA GABRILLE A. |
| Backend developer | JOMERO, Felijun |
| DevSecOps | FLORENTINO, Rex Matthew G. |
| Test Engineer | RAMOS, Christian Daryll Dave |

## Guide to the directories

The frontend is grouped by feature. HTML, JavaScript, and styles belong with their feature or in shared UI folders when reused. Registration and recovery remain dialogs within sign-in; the folder separation does not change the interface.

```text
HOPE/
├── frontend/
│   ├── login/
│   │   ├── sign-in/             # Sign-in page and login behavior
│   │   ├── create-account/      # Registration dialog behavior
│   │   ├── forgot-password/     # Recovery codes and password setup/reset
│   │   └── ui/                  # Shared login styles and presentation
│   ├── admin/
│   │   ├── dashboard/
│   │   ├── user-management/
│   │   ├── customers/
│   │   ├── products/
│   │   ├── human-resources/
│   │   ├── sales/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── ui/                  # Shared Admin tables, forms, and styles
│   └── shared/
│       ├── api/                 # Browser API helpers
│       ├── filters/             # Table filtering/grouping helpers
│       ├── sidebar/             # Shared sidebar template
│       ├── dialogs/             # Shared password guidance
│       ├── navigation/          # Persistent workspace navigation
│       └── assets/              # Fonts, icons, and images
├── backend/
│   ├── src/
│   │   ├── config/              # Supabase, runtime, resources, and permissions
│   │   ├── controllers/         # Authentication, Admin, and role handlers
│   │   ├── middleware/          # Authentication and authorization
│   │   ├── routes/              # API routes
│   │   ├── lib/                 # Sessions, mail, OAuth, queries, and mutations
│   │   ├── app.js               # Express application and static-file routing
│   │   └── server.js            # Startup and graceful shutdown
│   └── scripts/                 # Setup, diagnostics, and verification
├── database/
│   └── migrations/              # Supabase SQL migrations
├── testing/                     # Server, frontend, and isolated browser tests
├── .documentation/              # Setup, API, feature, deployment, and QA guides
├── .files/                      # Requirements and reference files
├── .github/workflows/           # CI and deployment workflows
├── .env                         # Private local settings; ignored by Git
├── .env.example                 # Public configuration template
├── .editorconfig                # UTF-8 editor settings
├── package.json                 # Dependencies and commands
├── package-lock.json            # Locked dependency versions
├── playwright.config.js         # Browser-test configuration
├── render.yaml                  # Render service configuration
├── Dockerfile                   # Optional production container
└── README.md
```

`node_modules/`, `var/`, `test-results/`, and `playwright-report/` are generated local folders ignored by Git. The root `.env` is not committed or served to browsers.

## Run locally

Use Node.js 22 or later. From the project root:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Fill in the private `.env` settings and use a database compatible with this branch. See [Backend setup](.documentation/BACKEND-SETUP.md) before initializing a database; do not replay base migrations on an existing live database.

```powershell
npm run doctor
npm start
```

Open **http://127.0.0.1:5000**. The backend serves the frontend and authenticated API together. Opening HTML files directly cannot provide login or database functionality. Existing `/UI-UX/...` browser URLs remain supported through the server route map, while source files live in `frontend/`.

## Environment configuration

[.env.example](.env.example) is the complete template. Minimum local settings:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-server-only-key
SESSION_SECRET=replace-with-a-random-secret-of-at-least-32-characters
APP_URL=http://localhost:5000
FRONTEND_ORIGINS=http://localhost:5000,http://127.0.0.1:5000
```

`SUPABASE_SERVICE_ROLE_KEY` is also accepted as a server-key alias. Use a server-only key for the backend, not a publishable key. `SESSION_SECRET` protects sessions; it is not an account password. Keep actual values private.

Google sign-in additionally needs `SUPABASE_PUBLISHABLE_KEY`, the Google provider configured in Supabase, an allowed application callback, and `GOOGLE_OAUTH_ENABLED=true`.

Email sending is configured separately from Google sign-in. Local SMTP is supported; Render Free requires an HTTPS option such as `MAIL_DELIVERY=gmail-api` with authorized sender credentials. Signing in through Google does not authorize sending recovery emails from that mailbox. See [Render setup](.documentation/RENDER.md) and [Email recovery](.documentation/email-recovery.md).

## Checks

```powershell
npm test
npx playwright install chromium
npm run test:browser
```

Integration/browser tests use disposable fixtures rather than the live database. Browser reports distinguish actual passes from documented expected failures; a successful command does not mean every known issue is fixed. Historical results are in [Sprint 1 QA](.documentation/testing/sprint1/README.md).

`npm run verify` is different: it checks the configured live project. Read the [Backend setup guide](.documentation/BACKEND-SETUP.md) before running operational setup or verification commands.

## Dependencies

Use `npm ci` to install the versions in `package-lock.json`. Express serves the API and frontend; Supabase stores records and sessions; bcryptjs verifies password hashes; express-session manages sessions; Helmet and CORS configure HTTP protections; dotenv loads local configuration; Nodemailer builds and sends email. PGlite and Playwright support isolated tests, and Nodemon supports development.

## Documentation

- [Project structure](.documentation/PROJECT-STRUCTURE.md)
- [Backend setup](.documentation/BACKEND-SETUP.md)
- [API reference](.documentation/API.md)
- [Admin records and dialogs](.documentation/LIVE-ADMIN.md)
- [Roles and permissions](.documentation/PERMISSION-ROLES.md)
- [Render deployment](.documentation/RENDER.md)
- [Updating the website](.documentation/UPDATING-HOPE.md)

This integration PR targets the original repository's main branch. Backend/schema differences need reconciliation before merging. Historical QA evidence in this branch does not certify a merged main build or substitute for teammate review.

## Main branch integration

See [integration decisions](.documentation/INTEGRATION.md) for the reconciled application, database differences and deployment prerequisites. Teammates' [Sprint 1 documents and UI mockups](.documentation/team-main/) are retained with their credits. The [original main implementation](.files/reference/README.md) is preserved as a source reference; `npm start` runs only the organized application. `npm test` also runs main's retained schema and grouping tests.
