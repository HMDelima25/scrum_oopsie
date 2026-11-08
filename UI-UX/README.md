# HOPE, Inc. Frontend Application

This directory contains the canonical, primary frontend application for the HOPE, Inc. ERP project. The authentication page is the first implemented screen, and the remaining ERP modules will be built into this application.

This is production-intent source code, not a disposable mockup or temporary scaffold. Future ERP pages must extend this application and its established patterns unless the team explicitly approves a migration.

## Preview

Open `index.html` directly or serve this directory with any static web server.

For example:

```powershell
python -m http.server 4173 --directory UI-UX
```

Then open `http://127.0.0.1:4173`.

## Application files

- `index.html` - authentication entry point and accessible markup reference
- `styles.css` - initial tokens, shared controls, page composition, and responsive rules
- `script.js` - login and registration validation, password visibility, multi-method password recovery, confirmation states, and feature navigation
- `FOUNDATION.md` - application architecture, extension rules, and migration safeguards

## Current integration status

The frontend interactions are implemented. Authentication and password-reset submission still require backend API contracts. The interface reports that boundary honestly instead of simulating a successful login.
