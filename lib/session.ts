import type { SessionOptions } from 'iron-session';

export interface SessionData {
  username?: string;
  loggedIn?: boolean;
}

const secret = process.env.SESSION_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
  // SESSION_SECRET is not configured — sessions still work but any attacker
  // with the source code can forge admin cookies. Set SESSION_SECRET in your
  // Vercel project settings immediately.
  console.error('[SECURITY] SESSION_SECRET env var is not set. Using insecure fallback.');
}

export const sessionOptions: SessionOptions = {
  cookieName: 'lumiere_admin_session',
  password: secret ?? 'lumiere-local-dev-only-not-for-production-32+',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  },
};
