-- Phase H: Customer ID (`customer_code`) for confirmed customers.
--
-- Apply via Supabase SQL editor (Project → SQL → New query → paste → Run).
-- Idempotent — safe to re-run.
--
-- Format: 4 digits + 4 uppercase letters (e.g. 4821KQXM). Generated and assigned
-- by the app on a customer's first CONFIRMED login (see lib/customer-code.ts).
-- Admin-only — never shown to the customer. `unique` guards against collisions;
-- the app retries on the rare clash.

alter table public.customer_profiles
  add column if not exists customer_code text unique;
