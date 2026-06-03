-- Phase C (ABC_promt.md): 5-state order status flow + shipping metadata
-- + admin/customer messaging thread.
--
-- Apply via Supabase SQL editor (Project → SQL → New query → paste → Run)
-- or via `supabase db push` if using the local CLI.
--
-- Idempotent — safe to re-run.

-- ----------------------------------------------------------------------------
-- 1) Status vocabulary migration.
-- Old vocab (from 001_init.sql comment): pending | paid | shipped | cancelled.
-- Actual existing values right now: 'pending' (4 rows), 'processing' (1 row).
-- Neither means "payment verified" — 'pending' is pre-proof, 'processing' is
-- proof-uploaded-awaiting-admin-verification. Both map to order_received.
-- ----------------------------------------------------------------------------

update public.orders
   set status = 'order_received'
 where status in ('pending', 'processing');

alter table public.orders
  alter column status set default 'order_received';

-- Replace the implicit "anything goes" type constraint with the new 6-value
-- vocab. The CHECK is dropped-then-recreated so re-running the migration
-- after a name conflict doesn't fail.
alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'order_received',
    'payment_verified',
    'packaging',
    'shipped',
    'delivered',
    'cancelled'
  ));

-- ----------------------------------------------------------------------------
-- 2) Shipping metadata. Required-on-`shipped` is enforced in the admin server
-- action (not at the DB level — keeps the schema lenient if a row is
-- back-edited).
-- ----------------------------------------------------------------------------

alter table public.orders
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists shipment_photo_path text,        -- path inside the private `shipment-photos` bucket
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- ----------------------------------------------------------------------------
-- 3) order_messages: admin ↔ customer thread per order, with an
-- `is_internal` flag for admin-only memos (mom can leave notes she doesn't
-- want the customer to see, e.g. "double-check screenshot is real").
-- ----------------------------------------------------------------------------

create table if not exists public.order_messages (
  id          uuid primary key default gen_random_uuid(),
  order_id    bigint not null references public.orders(id) on delete cascade,
  sender_role text not null check (sender_role in ('admin', 'customer')),
  body        text not null,
  is_internal boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists order_messages_order_id_idx
  on public.order_messages (order_id);

alter table public.order_messages enable row level security;

-- Customer can read messages on their own orders, but NEVER internal memos.
-- Admin (service role) bypasses RLS and sees everything.
-- No customer-write policy in v1 — all writes (admin messages, status
-- changes) happen server-side under the service role after the admin
-- session has been validated.
drop policy if exists "own order messages read" on public.order_messages;
create policy "own order messages read" on public.order_messages
  for select using (
    is_internal = false
    and exists (
      select 1 from public.orders o
      where o.id = order_messages.order_id
        and o.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4) Shipment photo storage.
-- Bucket creation is intentionally NOT in this migration — same pattern as
-- 004_payment_proofs.sql. Run `npm run setup:shipment-storage` after applying
-- this SQL to create the private `shipment-photos` bucket.
-- Server code mints 7-day signed URLs on demand; never public.
-- ----------------------------------------------------------------------------
