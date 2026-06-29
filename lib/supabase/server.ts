import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Fail loudly so Vercel function logs show the real cause instead of a
    // generic downstream fetch error.
    throw new Error(
      `Missing required env var: ${name}. ` +
        `Set it in Vercel → Project Settings → Environment Variables (Production scope) ` +
        `and redeploy without the build cache so NEXT_PUBLIC_* values inline correctly.`,
    );
  }
  return value;
}

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Read-only context (e.g. server component). Middleware handles refresh.
          }
        },
      },
    },
  );
}

export function createServiceClient() {
  return createServerClient(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}
