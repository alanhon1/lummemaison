-- Reported issues: a public "Report an issue" form (footer) lets anyone — logged
-- in or not — flag a bug or problem. Reports surface in the admin under the new
-- "Issues" tab (next to Reviews). Mirrors the feedback table (migration 009).
--
-- Writes go through a server action using the service role, and the admin reads
-- with the service client too, so both bypass RLS. RLS is enabled with NO public
-- policy, which locks the table down to those server-side paths only.
--
-- Apply via Supabase SQL editor (Project -> SQL -> New query -> paste -> Run).
-- Idempotent — safe to re-run.

create table if not exists public.reported_issues (
  id            bigserial primary key,
  message       text not null check (char_length(message) between 1 and 4000),
  contact_email text check (char_length(contact_email) <= 200),
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists reported_issues_created_idx
  on public.reported_issues (created_at desc);

alter table public.reported_issues enable row level security;
-- No policies: anon/authenticated have no direct access. The public report form
-- (server action) and the admin both use the service-role client, which bypasses
-- RLS.
