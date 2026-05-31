import { NextResponse } from 'next/server';

// Temporary diagnostic endpoint — confirms whether the Supabase env vars
// reached the running build. Returns presence booleans only; values are
// never exposed. Remove this route once production is healthy.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    nodeEnv: process.env.NODE_ENV,
  });
}
