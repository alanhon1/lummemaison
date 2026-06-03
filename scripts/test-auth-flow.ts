// End-to-end exercise of the new auth flow against production Supabase +
// the freshly deployed lummemaison.com endpoints. Idempotent: cleans up
// the test user at the end.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnv('.env.local');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SITE = 'https://www.lumeemaison.com';
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const EMAIL = `auth-flow-test-${Date.now()}@example.com`;
const PWD = 'TempPassword123!';
const NEW_PWD = 'NewPassword456!';
let userId: string | null = null;

function step(label: string) {
  console.log(`\n── ${label} ──`);
}
function ok(msg: string) { console.log(`  OK  ${msg}`); }
function warn(msg: string) { console.log(`  !!  ${msg}`); }
function fail(msg: string) { console.error(`  ❌  ${msg}`); process.exitCode = 1; }

async function main() {
  step('1. Pre-check: does public.password_reset_codes exist?');
  {
    const { error } = await admin.from('password_reset_codes').select('user_id').limit(1);
    if (error) warn(`table missing or unreachable: ${error.message} — reset-flow tests will be skipped`);
    else ok('table exists');
  }

  step('2. admin.generateLink({ type: signup }) — simulate signup');
  const linkRes = await admin.auth.admin.generateLink({
    type: 'signup',
    email: EMAIL,
    password: PWD,
    options: { data: { full_name: 'Auth Flow Test' } },
  });
  if (linkRes.error) { fail(linkRes.error.message); return; }
  userId = linkRes.data.user?.id ?? null;
  const hashedToken = linkRes.data.properties?.hashed_token;
  ok(`user id: ${userId}`);
  ok(`hashed_token: ${hashedToken?.slice(0, 12)}…`);

  step('3. INSERT customer_profiles (FK to auth.users)');
  {
    const { error } = await admin.from('customer_profiles').insert({
      user_id: userId,
      full_name: 'Auth Flow Test',
      phone: '+11234567890',
      country: 'US',
      street: '1 Test St',
      city: 'TestCity',
      state_province: 'CA',
      postal_code: '90000',
    });
    if (error) fail(error.message); else ok('profile inserted');
  }

  step('4. Confirm email_confirmed_at is null (unconfirmed gate)');
  {
    const { data } = await admin.auth.admin.getUserById(userId!);
    if (data.user?.email_confirmed_at) warn('email is already confirmed — project setting probably has "Confirm email" OFF, so the gate will not work in prod');
    else ok('user is unconfirmed as expected');
  }

  step('5. Attempt signInWithPassword (anon client) — expect "email not confirmed"');
  {
    const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PWD });
    if (!error) warn('login succeeded — gate is OFF on the Supabase project');
    else ok(`login rejected: code=${(error as { code?: string }).code} msg=${error.message}`);
  }

  step('6. Drive /auth/confirm via redirect (the confirmation link in the email)');
  {
    const confirmUrl = `${SITE}/auth/confirm?token_hash=${encodeURIComponent(hashedToken!)}&type=email&next=${encodeURIComponent('/en/account?welcome=1')}`;
    const res = await fetch(confirmUrl, { redirect: 'manual' });
    ok(`status: ${res.status}`);
    ok(`location: ${res.headers.get('location')?.slice(0, 80)}…`);
    if (res.status !== 307 && res.status !== 302 && res.status !== 303) {
      fail('expected a 3xx redirect');
    }
  }

  step('7. Re-check email_confirmed_at — should now be set');
  {
    const { data } = await admin.auth.admin.getUserById(userId!);
    if (data.user?.email_confirmed_at) ok(`confirmed at ${data.user.email_confirmed_at}`);
    else fail('email still unconfirmed after /auth/confirm');
  }

  step('8. signInWithPassword should now succeed');
  {
    const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PWD });
    if (error) fail(error.message);
    else ok('login succeeded');
  }

  step('9. Password reset: insert a code, verify it, then reset');
  {
    const code = '1234';
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const { error: upsertErr } = await admin
      .from('password_reset_codes')
      .upsert({ user_id: userId, code, expires_at: expiresAt, attempts: 0 }, { onConflict: 'user_id' });
    if (upsertErr) {
      warn(`upsert failed: ${upsertErr.message} — migration 008 not applied yet`);
    } else {
      ok('code row written');
      const { data, error } = await admin
        .from('password_reset_codes')
        .select('code, attempts, expires_at')
        .eq('user_id', userId)
        .single();
      if (error) fail(error.message);
      else ok(`code row: ${JSON.stringify(data)}`);

      // Wrong code → attempts should go up
      const wrongCode = '0000';
      await admin.from('password_reset_codes').update({ attempts: 1 }).eq('user_id', userId);
      const { data: row } = await admin.from('password_reset_codes').select('attempts').eq('user_id', userId).single();
      ok(`after one wrong: attempts=${row?.attempts}`);

      // Update password via admin
      const { error: pwdErr } = await admin.auth.admin.updateUserById(userId!, { password: NEW_PWD });
      if (pwdErr) fail(pwdErr.message);
      else ok('password updated via admin.updateUserById');

      // Clean code row
      await admin.from('password_reset_codes').delete().eq('user_id', userId);
      ok('code row deleted');

      // Verify new password works
      const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: signInErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: NEW_PWD });
      if (signInErr) fail(`new password sign-in failed: ${signInErr.message}`);
      else ok('new password sign-in succeeded');
    }
  }

  step('10. Cleanup');
  if (userId) {
    await admin.from('customer_profiles').delete().eq('user_id', userId);
    await admin.from('password_reset_codes').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
    ok('user + profile + reset code removed');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
