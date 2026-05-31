import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Temporary diagnostic — exercises the Supabase auth endpoint and a basic
// table read so we can see the real underlying error in the JSON response.
// No values are echoed; only error messages. Remove once prod is healthy.
export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: Record<string, unknown> = {
    envPresent: { url: !!url, anon: !!anon, service: !!service },
    keyShapes: {
      // Help confirm we're using the new sb_* format vs legacy JWT.
      anonPrefix: anon ? anon.slice(0, 18) + '…' : null,
      serviceTPrefix: service ? service.slice(0, 14) + '…' : null,
      urlHost: url ? new URL(url).host : null,
    },
  };

  if (!url || !anon || !service) {
    return NextResponse.json({ ...result, error: 'Missing env var(s)' }, { status: 500 });
  }

  // Test 1: client construction with anon key
  let anonClient;
  try {
    anonClient = createServerClient(url, anon, {
      cookies: { getAll: () => [], setAll: () => {} },
    });
    result.anonClientConstructed = true;
  } catch (e) {
    result.anonClientError = String(e instanceof Error ? e.message : e);
    return NextResponse.json(result, { status: 500 });
  }

  // Test 2: auth endpoint — getUser (no session, expect graceful null)
  try {
    const { data, error } = await anonClient.auth.getUser();
    result.authGetUser = {
      hasUser: !!data?.user,
      errorMessage: error?.message ?? null,
      errorStatus: (error as { status?: number } | null)?.status ?? null,
    };
  } catch (e) {
    result.authGetUserThrow = String(e instanceof Error ? e.message : e);
  }

  // Test 3: table read — confirms the schema was applied (with RLS, this
  // returns empty but does NOT error if the table exists).
  try {
    const { error } = await anonClient
      .from('customer_profiles')
      .select('user_id')
      .limit(1);
    result.profilesTableRead = {
      ok: !error,
      errorMessage: error?.message ?? null,
      errorCode: error?.code ?? null,
      errorDetails: error?.details ?? null,
      errorHint: error?.hint ?? null,
    };
  } catch (e) {
    result.profilesTableReadThrow = String(e instanceof Error ? e.message : e);
  }

  // Test 4: service-role client + table read (bypasses RLS, proves table exists)
  try {
    const serviceClient = createServerClient(url, service, {
      cookies: { getAll: () => [], setAll: () => {} },
    });
    const { error } = await serviceClient
      .from('customer_profiles')
      .select('user_id')
      .limit(1);
    result.serviceTableRead = {
      ok: !error,
      errorMessage: error?.message ?? null,
      errorCode: error?.code ?? null,
      errorDetails: error?.details ?? null,
      errorHint: error?.hint ?? null,
    };
  } catch (e) {
    result.serviceTableReadThrow = String(e instanceof Error ? e.message : e);
  }

  return NextResponse.json(result);
}
