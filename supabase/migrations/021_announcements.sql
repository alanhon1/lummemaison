-- 021: Announcements — store-wide notices shown to customers.
--
-- Admin (app/manzura/announcements) creates/edits announcements; the customer
-- site shows active ones as a log page (/announcements) and, when `placement`
-- targets a page, as a one-time popup on that page (after the disclaimer is
-- accepted).
--
-- `placement` controls where the popup appears:
--   home      → popup on the homepage only
--   catalogue → popup on /catalogue only
--   both      → popup on home and catalogue
--   none      → no popup; only listed on the /announcements log page
--
-- Read/written EXCLUSIVELY through the service-role client (cached loader in
-- lib/announcements.ts + admin server actions), so RLS is enabled with NO
-- policy → anon/authenticated get zero access, service role bypasses it. Same
-- pattern as 020_security_rls_hardening.

create table if not exists public.announcements (
  id          bigserial primary key,
  title       text not null,
  body        text not null,
  image_url   text,
  placement   text not null default 'none'
              check (placement in ('home', 'catalogue', 'both', 'none')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The customer site loads active announcements newest-first.
create index announcements_active_idx on public.announcements (active, created_at desc);

alter table public.announcements enable row level security;
-- Intentionally NO policies: service-role server path only.
