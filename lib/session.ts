import type { SessionOptions } from 'iron-session';

export interface SessionData {
  username?: string;
  loggedIn?: boolean;
}

export const sessionOptions: SessionOptions = {
  cookieName: 'lumiere_admin_session',
  password: process.env.SESSION_SECRET ?? 'lumiere-admin-fallback-secret-key-32chars!!',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  },
};
