# HOPE, Inc. Frontend Application

This directory contains the canonical, primary frontend application for the HOPE, Inc. ERP project. The authentication page is the first implemented screen, and the remaining ERP modules will be built into this application.

This is production-intent source code, not a disposable mockup or temporary scaffold. Future ERP pages must extend this application and its established patterns unless the team explicitly approves a migration.

## Preview

The connected app must be served by the backend. From the repository root, run `npm start`, then open `http://127.0.0.1:5000/`. Its authenticated API requests use that same origin.

For example:

```powershell
npm start
```

Then open `http://127.0.0.1:5000`. See [Live Admin](../docs/LIVE-ADMIN.md) for two-way record updates, form choices and verification.

## Application files

- `index.html` - authentication entry point and accessible markup reference
- `styles.css` - initial tokens, shared controls, page composition, and responsive rules
- `script.js` - login and registration validation, password visibility, multi-method password recovery, confirmation states, and feature navigation
- `FOUNDATION.md` - application architecture, extension rules, and migration safeguards

## Current integration status

The authentication page now loads `shared/utilities/live-auth.js`; module pages load `shared/utilities/live-admin.js`. Historical fixture/runtime files remain as design references and are not loaded by these entry pages. Records and choices come from the connected backend/Supabase. Saves persist there; external record edits refresh within five seconds while visible. No accounts or business fixtures were seeded into live Supabase.
