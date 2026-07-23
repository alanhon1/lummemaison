// Small helpers for server-side diagnostic logging.
//
// Signup/auth failures previously left no trace at all in the Vercel function
// logs, so a customer reporting "it won't let me create an account" could not
// be matched to a cause after the fact. These helpers make those logs
// greppable (single-line JSON, stable `[scope] event` prefix) without ever
// writing a raw email address into the log stream.

// Masks an email for logging: "buyer@example.com" -> "b***r@example.com".
// Keeps enough shape to correlate with a support ticket, without storing the
// address itself in logs. Non-email input is masked wholesale.
export function maskEmail(email: string | null | undefined): string {
  const value = (email ?? '').trim();
  if (!value) return '(empty)';
  const at = value.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const shown =
    local.length <= 2
      ? `${local[0]}*`
      : `${local[0]}${'*'.repeat(Math.min(local.length - 2, 3))}${local[local.length - 1]}`;
  return `${shown}@${domain}`;
}

// Normalises anything throwable/returned-as-error into a log-safe string.
export function errorMessage(e: unknown): string {
  if (!e) return '';
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (typeof e === 'object') {
    const o = e as { message?: unknown; code?: unknown };
    if (typeof o.message === 'string') return o.message;
  }
  return String(e);
}

// Emits one greppable line: `[scope] event {json}`.
// Search Vercel logs for "[signup]" to get every signup failure with its stage.
export function logEvent(
  scope: string,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  let payload: string;
  try {
    payload = JSON.stringify(fields);
  } catch {
    payload = '{"_":"unserialisable"}';
  }
  console.error(`[${scope}] ${event} ${payload}`);
}
