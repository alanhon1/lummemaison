-- Phase H: scheduled cleanup of stale UNCONFIRMED signups.
--
-- ⚠️ DESTRUCTIVE. Review carefully before applying. Deleting an auth.users row
-- cascades (on delete cascade) to customer_profiles AND orders. The WHERE clause
-- is therefore deliberately narrow: only rows that have NEVER confirmed their
-- email AND are older than 24h. A confirmed customer is never touched. Such
-- unconfirmed users cannot place orders (checkout requires a confirmed login),
-- so no real order is ever lost.
--
-- Apply via Supabase SQL editor (Project → SQL → New query → paste → Run).
-- Requires pg_cron (available on Supabase). Idempotent — safe to re-run.

create extension if not exists pg_cron;

-- security definer so the daily job (running as the cron role) can delete from
-- the auth schema. Owned by postgres when created from the SQL editor.
create or replace function public.purge_unconfirmed_users()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users
  where email_confirmed_at is null
    and created_at < now() - interval '24 hours';
$$;

-- (Re)schedule the daily job at 03:00 UTC. Unschedule first so re-running this
-- migration doesn't stack duplicate jobs.
do $$
begin
  perform cron.unschedule('purge-unconfirmed-users');
exception when others then
  null; -- not scheduled yet
end $$;

select cron.schedule(
  'purge-unconfirmed-users',
  '0 3 * * *',
  $$select public.purge_unconfirmed_users()$$
);
