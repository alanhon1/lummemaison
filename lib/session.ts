import type { SessionOptions } from 'iron-session';

export interface SessionData {
  username?: string;
  loggedIn?: boolean;
}

export const sessionOptions: SessionOptions = {
  cookieName: 'lumiere_admin_session',
  password: process.env.SESSION_SECRET as string,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  },
};
