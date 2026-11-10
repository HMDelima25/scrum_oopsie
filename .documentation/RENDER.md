# Render deployment

Use a Free Web Service in Singapore, sourced from `riellealia/scrum_oopsie`, branch `codex/hope-railway-deploy`, with repository root unchanged.

- Node 22; build `npm ci --omit=dev`; start `npm start`.
- Set NODE_ENV=production, HOST=0.0.0.0 and TRUST_PROXY=1.
- Store SUPABASE_URL, SUPABASE_SECRET_KEY and a separately generated SESSION_SECRET privately in Render. Never commit .env.
- APP_URL and FRONTEND_ORIGINS default to Render's assigned external URL. Explicit values override these defaults for custom domains.
- Health check `/api/health` verifies the Supabase connection. Migrations are not run at startup.
- The existing service now uses the authenticated GitHub connection, limited to `riellealia/scrum_oopsie`, with Auto-Deploy set to On Commit. Pushes to `codex/hope-railway-deploy` automatically build and deploy the website. Other branches do not update the live site. See [Updating HOPE](UPDATING-HOPE.md).

Render Free sleeps while idle. Gmail SMTP ports are blocked. Both recovery codes and setup invitations now support Gmail's HTTPS API: set MAIL_DELIVERY=gmail-api and privately configure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN and MAIL_FROM. Authorize the sender account with the narrow gmail.send permission. This is separate from users signing into HOPE with Google; existing SMTP app passwords cannot be used as Gmail API tokens. The code does not grant this permission or send a real email during tests. Until sender authorization is configured, hosted email remains unavailable.

Google sign-in separately needs SUPABASE_PUBLISHABLE_KEY and the exact `https://hope-erp-cgko.onrender.com/api/auth/google/callback` allowed in Supabase before GOOGLE_OAUTH_ENABLED can be enabled. No Google provider access has been expanded by these code changes.

`render.yaml` records the Free service configuration for reproducible deployments; it does not modify the existing service by itself. Render's assigned URL supplies same-origin defaults, its port is honored, and it automatically binds to 0.0.0.0 and trusts one reverse proxy unless explicitly overridden. HTTPS is required for the Render app URL. Health checks run before sessions, never set cookies and time out the database probe after 3.5 seconds. Shutdown drains requests and exits within 25 seconds of SIGTERM.

Live service: https://hope-erp-cgko.onrender.com. Do not create another service when updating this existing service.

Check health, login assets, protected-route denial and secure session behavior after deployment. Four pre-existing application limitations are documented in the Sprint 1 QA register.
