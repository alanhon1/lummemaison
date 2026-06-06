-- Phase G: customer feedback (👍 / 👎 + optional comment) captured on the
-- order-confirmation screen.
--
-- Apply via Supabase SQL editor (Project → SQL → New query → paste → Run).
-- Idempotent — safe to re-run.
--
-- Flow: the 👍/👎 click inserts a row immediately (rating is captured even if
-- the customer never writes a comment); the optional comment is attached to
-- that same row on submit. One feedback per order.

create table if not exists public.feedback (
  id         bigserial primary key,
  order_id   bigint references public.orders(id) on delete set null,
  user_id    uuid references auth.users(id) on delete set null,
  rating     text not null check (rating in ('up', 'down')),
  comment    text,
  is_read    boolean not null default false,   -- admin read-state
  created_at timestamptz not null default now()
);

-- One feedback per order (the UI also guards; this enforces it at the DB).
create unique index if not exists feedback_order_id_key
  on public.feedback (order_id) where order_id is not null;

create index if not exists feedback_created_idx on public.feedback (created_at);

alter table public.feedback enable row level security;

-- A customer can read / insert / update-comment their OWN feedback. The admin
-- (service role) bypasses RLS for the Feedbacks tab and for is_read updates.
drop policy if exists "own feedback read" on public.feedback;
create policy "own feedback read" on public.feedback
  for select using (auth.uid() = user_id);

drop policy if exists "own feedback insert" on public.feedback;
create policy "own feedback insert" on public.feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists "own feedback update comment" on public.feedback;
create policy "own feedback update comment" on public.feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
