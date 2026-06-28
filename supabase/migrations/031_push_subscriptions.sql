create table if not exists public.push_subscriptions (
  id           bigserial primary key,
  endpoint     text unique not null,
  p256dh       text not null,
  auth         text not null,
  client_code  text,                      -- set to the customer id when logged in; null for anon
  created_at   timestamptz not null default now()
);
-- Writes happen only via service-role API routes; enable RLS with no public policy.
alter table public.push_subscriptions enable row level security;
