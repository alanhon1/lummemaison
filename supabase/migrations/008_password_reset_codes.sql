-- Custom 4-digit OTP table for the "Forgot password?" flow.
-- Supabase has its own recovery flow but it uses an email magic link, not a
-- 4-digit code — and we've hit Supabase's internal SMTP rate limit, so we
-- prefer to send via our own Nodemailer (lib/email/mailer.ts).
--
-- One row per user (PK on user_id) — re-requesting a code overwrites the
-- previous one. attempts is incremented on each verify; we refuse after
-- 5 wrong tries until expires_at passes. expires_at is set to now() + 10
-- minutes by the server action.
--
-- RLS: read-only for the row owner (defence in depth — the code stays
-- server-side anyway). All writes are server-side under the service role.

create table if not exists public.password_reset_codes (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  code        text not null check (code ~ '^[0-9]{4}$'),
  expires_at  timestamptz not null,
  attempts    int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.password_reset_codes enable row level security;

drop policy if exists "own reset code read" on public.password_reset_codes;
create policy "own reset code read" on public.password_reset_codes
  for select using (auth.uid() = user_id);

-- Convenience: clear expired rows on every insert so the table stays small.
create or replace function public.password_reset_codes_purge_expired()
returns trigger language plpgsql as $$
begin
  delete from public.password_reset_codes where expires_at < now();
  return new;
end;
$$;

drop trigger if exists password_reset_codes_purge_expired_trg on public.password_reset_codes;
create trigger password_reset_codes_purge_expired_trg
  before insert on public.password_reset_codes
  for each statement execute function public.password_reset_codes_purge_expired();
