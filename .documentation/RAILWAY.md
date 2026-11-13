# Railway deployment

Deploy the complete project from the repository root. The Docker image uses Node 22, production dependencies, backend and frontend only. The root .env, reference files, tests, database migrations and documentation are excluded. Railway injects PORT; the container listens on 0.0.0.0. It trusts one reverse proxy so HTTPS session cookies work behind Railway.

## Service configuration

- Source: the deployment branch in Natalia's GitHub fork, not the original team's main branch.
- Builder: root Dockerfile; start: npm start.
- Health check: /api/health (also checks the configured Supabase users table).
- Generate a Railway public domain before configuring APP_URL and FRONTEND_ORIGINS.
- Set NODE_ENV=production, HOST=0.0.0.0 and TRUST_PROXY=1.
- Set APP_URL and FRONTEND_ORIGINS to the exact HTTPS public URL.
- Store SUPABASE_URL, server-only SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) and a fresh SESSION_SECRET of at least 32 random characters in Railway Variables. Never commit them.
- For email, configure MAIL_DELIVERY=smtp, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and MAIL_FROM privately.
- Google sign-in additionally requires SUPABASE_PUBLISHABLE_KEY, GOOGLE_OAUTH_ENABLED=true and the deployed /api/auth/google/callback URL allowed by Supabase. Inspect the actual OAuth route when configuring; do not substitute the provider's Supabase callback for the application's callback.

No database migrations run automatically during server startup. Use the existing compatible Supabase project; do not replay base migrations on its live data. Sessions persist in Supabase. Local outbox files are not persistent cloud delivery.

## Verification

Confirm the deployed health check succeeds, the login page and assets return 200, unauthenticated admin APIs deny access, and secure session cookies survive a real approved-account login. Check Google redirects and delivery separately. A successful build alone is not deployment verification.

The Railway account currently needs Terms acceptance and a plan change after its trial expiry. Hosting is not yet live. Four previously documented application limitations remain; see the Sprint 1 bug register.
