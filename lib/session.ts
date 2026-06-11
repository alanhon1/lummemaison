import type { SessionOptions } from 'iron-session';

export interface SessionData {
  username?: string;
  loggedIn?: boolean;
}

const secret = process.env.SESSION_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
  // Hard-fail in production. With no SESSION_SECRET the session would be signed
  // with a fallback string baked into the source, letting anyone who has the
  // code forge a valid admin cookie and take over the panel. Refusing to boot
  // is the safe behaviour — set SESSION_SECRET in Vercel → Environment
  // Variables (e.g. `openssl rand -hex 32`) and redeploy.
  throw new Error(
    '[SECURITY] SESSION_SECRET is not set in production. Refusing to start with an insecure fallback.',
  );
}

export const sessionOptions: SessionOptions = {
  cookieName: 'lumiere_admin_session',
  // In production `secret` is guaranteed non-empty by the guard above. The
  // fallback is reached only in dev/test where forging a local cookie is moot.
  password: secret ?? 'lumiere-local-dev-only-not-for-production-32+',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  },
};
