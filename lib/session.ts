import type { SessionOptions } from 'iron-session';

export interface SessionData {
  username?: string;
  loggedIn?: boolean;
}

const secret = process.env.SESSION_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET environment variable must be set in production');
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
