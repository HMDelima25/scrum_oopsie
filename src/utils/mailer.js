const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, APP_URL } = process.env;

const configured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
const port = Number(SMTP_PORT || 587);

const transporter = configured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

if (!configured) {
  console.warn('⚠️  Email is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing in .env). Reset links will only be printed in this console.');
}

// Sends the password-reset link. Returns true if an email was sent.
async function sendPasswordResetEmail(to, token) {
  const base = (APP_URL || 'http://localhost:5000').replace(/\/$/, '');
  const link = `${base}/reset-password.html?token=${encodeURIComponent(token)}`;

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is required to send account setup and password recovery email in production.');
    }
    // Development fallback only: the link stays in the server console, never in an HTTP response.
    console.log(`\n🔑 Password reset link for ${to}:\n${link}\n`);
    return false;
  }

  await transporter.sendMail({
    from: MAIL_FROM || SMTP_USER,
    to,
    subject: 'Reset your HOPE, Inc. password',
    text:
      'We received a request to reset your HOPE, Inc. password.\n\n' +
      `Open this link to choose a new password (it expires in 1 hour):\n${link}\n\n` +
      'If you did not request this, you can ignore this email.',
    html:
      '<p>We received a request to reset your HOPE, Inc. password.</p>' +
      `<p><a href="${link}">Choose a new password</a> (the link expires in 1 hour).</p>` +
      '<p>If you did not request this, you can ignore this email.</p>',
  });

  return true;
}

module.exports = { sendPasswordResetEmail };