import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Called from proxy.ts on every public request. Reads/writes the auth cookies
// so that server components observe a stable, refreshed session.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // If env vars are not configured (e.g. preview without Supabase), skip cleanly.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching getUser() triggers Supabase to refresh the session if needed.
  await supabase.auth.getUser();

  return response;
}
