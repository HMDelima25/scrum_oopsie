# Render deployment

Use a Free Web Service in Singapore, sourced from `riellealia/scrum_oopsie`, branch `codex/hope-railway-deploy`, with repository root unchanged.

- Node 22; build `npm ci --omit=dev`; start `npm start`.
- Set NODE_ENV=production, HOST=0.0.0.0 and TRUST_PROXY=1.
- Store SUPABASE_URL, SUPABASE_SECRET_KEY and a separately generated SESSION_SECRET privately in Render. Never commit .env.
- APP_URL and FRONTEND_ORIGINS default to Render's assigned external URL. Explicit values override these defaults for custom domains.
- Health check `/api/health` verifies the Supabase connection. Migrations are not run at startup.
- The public Git repository connection does not provide automatic deployment. Deploy future changes manually or separately authorize the GitHub repository integration.

Render Free sleeps while idle. Gmail SMTP ports are blocked, so current SMTP-based account/recovery email delivery is not available on this host. HTTPS email integration needs separate configuration. Google sign-in additionally needs the deployed callback allowed in Supabase before it can be enabled.

Check health, login assets, protected-route denial and secure session behavior after deployment. Four pre-existing application limitations are documented in the Sprint 1 QA register.
