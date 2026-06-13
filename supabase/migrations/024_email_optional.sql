-- Phase: make email confirmation OPTIONAL.
--
-- Background: checkout requires a logged-in account, and GoTrue blocks login
-- for users whose email isn't confirmed. When our transactional SMTP fails to
-- deliver the confirmation link, customers get stuck — they can never log in,
-- so they can never buy. Per the owner's decision, email confirmation is now
-- optional: accounts work without it, and unconfirmed users are simply flagged
-- in the admin so the team knows their email may be unreachable.
--
-- This migration:
--   1. Adds our own `email_verified` flag to customer_profiles (true only once
--      the customer actually clicks the confirmation/verify link). The admin
--      "Email not confirmed" badge reads THIS column — not auth.users, which we
--      now mark confirmed up-front so login always works.
--   2. Backfills `email_verified` from the current auth.users confirmation state
--      so existing genuinely-confirmed customers keep their verified status.
--   3. Un-sticks every existing unconfirmed auth user (sets email_confirmed_at)
--      so they can log in immediately. Their email_verified stays false, so the
--      admin badge still shows they never verified.
--   4. Disables the destructive daily purge of unconfirmed users (migration 011)
--      — unconfirmed accounts are legitimate customers now and must not be
--      deleted.
--
-- Apply via Supabase SQL editor (Project -> SQL -> New query -> paste -> Run).
-- Idempotent — safe to re-run.

-- 1. Our verification flag.
alter table public.customer_profiles
  add column if not exists email_verified boolean not null default false;

-- 2. Backfill from current confirmation state BEFORE we un-stick everyone in
--    step 3 (order matters: this must read the original auth.users state).
update public.customer_profiles p
set email_verified = true
from auth.users u
where u.id = p.user_id
  and u.email_confirmed_at is not null;

-- 3. One-time un-stick: let every existing unconfirmed user log in. They keep
--    email_verified = false (set in step 1's default), so the badge still shows.
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;

-- 4. Stop the daily purge of unconfirmed users (was scheduled by migration 011).
do $$
begin
  perform cron.unschedule('purge-unconfirmed-users');
exception when others then
  null; -- job not scheduled / pg_cron absent — nothing to do
end $$;

drop function if exists public.purge_unconfirmed_users();
