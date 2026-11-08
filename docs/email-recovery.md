# Password recovery

Forgot password uses the email saved on a non-archived application account. It sends a six-digit numeric code, never a reset link. Codes expire after 10 minutes, are limited to five attempts, and are replaced on resend. Requests are limited per IP, browser session and account. Confirmation creates a session-bound, single-use password grant valid for 10 minutes. The new password must have at least 12 characters, uppercase and lowercase letters, a number and a symbol, remain within 72 UTF-8 bytes, and match its confirmation. Existing sessions are revoked by the password-change trigger; account approval and roles remain unchanged.

The response does not reveal whether an email is registered. Codes and password grants are never returned in responses or stored in plain text in the database. Setup invitations still use the separate account-setup flow.

## Outgoing email

Google login identifies the user; it does not authorize HOPE to send email. Configure one sender in the ignored `.env`. Codes go to each user's registered email, including Gmail and other providers.

For Gmail SMTP, use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<sender address>`, `SMTP_PASSWORD=<Google app password>`, `MAIL_FROM=<sender address>`, and `MAIL_DELIVERY=smtp`. The sender needs an app password supported by its Google account. Never commit credentials or paste them into chat. Restart the server after configuration. Other SMTP providers can use the same variables.

Recovery refuses to claim delivery when SMTP is missing or fails. `MAIL_DELIVERY=local` does not simulate a sent recovery email. Tests inject a private in-memory transport and use synthetic accounts; no real user password changes are needed.

Apply migration `20261108001600_email_recovery_codes.sql` before restarting the backend.
