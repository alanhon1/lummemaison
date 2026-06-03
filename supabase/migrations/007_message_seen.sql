-- Per-order "messages last seen" timestamp. Used to show an unread indicator
-- on the customer Account page when admin has posted a message since the
-- customer last opened the order detail.
--
-- Apply via Supabase SQL editor (Project → SQL → New query → paste → Run).
-- Idempotent — safe to re-run.

alter table public.orders
  add column if not exists last_message_seen_at timestamptz;

-- No backfill: existing rows stay NULL, which means "never seen" → any
-- existing customer-visible message will surface as new on the next visit.
