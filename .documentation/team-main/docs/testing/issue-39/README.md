# Login browser smoke — issue #39

Review contribution; Christian Ramos retains ownership. Targets original main `a0c7da9` without importing the fork server or migrations.

Prepare a disposable local database using main's migrations and an approved test account. Start main against that database on port 5001. Run `npm ci`, then `npx playwright install chromium`.

Configure `HOPE_TEST_URL` (default `http://127.0.0.1:5001`), `HOPE_TEST_USERNAME` and `HOPE_TEST_PASSWORD` privately in your terminal environment. Run `npx playwright test`. Remove the credential variables afterwards. Use a dedicated account without concurrent sessions.

The test uses the real form and server, checks successful authentication, the Dashboard heading and records endpoint, then logs out and verifies denial of protected requests. It does not provision accounts, load .env, reset a database or mock authentication. Missing credentials and non-loopback URLs fail explicitly. The local server must use a disposable database, not production.

Trace, screenshot and video capture are disabled to avoid recording credentials or response data.

Validation: syntax and discovery are checked separately from execution. Full main browser execution is NOT RUN until a compatible disposable main database and approved account are available. Discovery is not proof of authentication correctness. Other issue #39 acceptance items (salted hashes, token security, rate limiting and all roles) require additional tests. Human review remains pending.
