-- 020: Security hardening — close RLS gaps + atomic rate-limit helpers.
--
-- BACKGROUND
-- Five tables were created in earlier migrations WITHOUT enabling Row-Level
-- Security. In Supabase, a table with RLS disabled is fully readable AND
-- writable through PostgREST using the PUBLIC anon key (which ships in the
-- browser bundle). That meant anyone could, with no auth:
--   • read every customer chatbot question / support enquiry (PII), and
--   • insert / update / delete promo codes (e.g. craft a 100%-off code).
--
-- All five tables are accessed EXCLUSIVELY through the service-role client on
-- the server (admin pages under app/manzura/**, /api/chat, /api/faq-feedback).
-- The service role bypasses RLS, so enabling RLS with NO anon/authenticated
-- policy locks each table to server-only access WITHOUT breaking any feature.

alter table public.promo_codes          enable row level security;
alter table public.faqs                 enable row level security;
alter table public.faq_feedback         enable row level security;
alter table public.chat_questions       enable row level security;
alter table public.unanswered_questions enable row level security;

-- Intentionally NO policies: anon/authenticated get zero access; the server's
-- service-role client continues to bypass RLS for every operation.


-- ---------------------------------------------------------------------------
-- Atomic chatbot rate limit.
--
-- The old code did read-count → check → upsert(count+1) as three steps, so two
-- concurrent requests could both read the same count and each proceed, slipping
-- past the daily cap (cost-abuse race). This function does the check-and-bump in
-- a single atomic statement and returns the resulting count. When the row is
-- already at/over the limit the UPDATE is skipped and we return limit+1.
create or replace function public.increment_chat_usage(
  p_session_id text,
  p_date       date,
  p_limit      integer
) returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into public.chat_usage (session_id, date, count)
    values (p_session_id, p_date, 1)
  on conflict (session_id, date) do update
    set count = public.chat_usage.count + 1
    where public.chat_usage.count < p_limit
  returning count into v_count;

  -- v_count is NULL only when the row existed and the WHERE blocked the bump
  -- (already at/over the limit) — signal "over limit" to the caller.
  if v_count is null then
    return p_limit + 1;
  end if;
  return v_count;
end;
$$;

-- Lock the RPC to the server. Functions in the public schema are exposed via
-- PostgREST and callable by anon BY DEFAULT — revoke that and grant only the
-- service role so the browser anon key can never invoke it.
revoke all on function public.increment_chat_usage(text, date, integer) from public;
grant execute on function public.increment_chat_usage(text, date, integer) to service_role;


-- ---------------------------------------------------------------------------
-- Global (cross-instance) brute-force guard for the admin login.
--
-- The in-memory Map limiter in /api/admin/auth resets per serverless instance,
-- so an attacker could spread attempts across cold starts. This table gives the
-- server a shared counter. RLS on, no policy → service-role only.
create table if not exists public.admin_login_attempts (
  ip        text primary key,
  count     integer not null default 0,
  reset_at  timestamptz not null
);
alter table public.admin_login_attempts enable row level security;
-- Intentionally NO policies: service-role server path only.
