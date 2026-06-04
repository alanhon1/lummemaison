import nodemailer, { type Transporter } from 'nodemailer';

let cached: Transporter | undefined;

// Every env var that must be present for outbound email to work. SMTP_FROM is
// the one that has historically been forgotten in production (it's checked
// separately from the transporter creds, so a missing FROM half-completes the
// signup flow — account created, email not sent).
const REQUIRED_EMAIL_VARS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
] as const;

// Returns the names of any required email env vars that are missing/empty.
// Empty array = fully configured. Use for clear server-side diagnostics.
export function missingEmailEnv(): string[] {
  return REQUIRED_EMAIL_VARS.filter((k) => !process.env[k]);
}

// Lazy nodemailer transporter for Namecheap Private Email SMTP.
// Reads SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS from env.
// `secure` is derived from port (465 = implicit TLS).
export function getTransporter(): Transporter {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !portStr || !user || !pass) {
    throw new Error(
      '[email/mailer] Missing SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in environment',
    );
  }

  const port = Number(portStr);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`[email/mailer] Invalid SMTP_PORT: ${portStr}`);
  }

  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return cached;
}
