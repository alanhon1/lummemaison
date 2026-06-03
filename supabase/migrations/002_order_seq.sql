-- Phase 1: SGL #005000 order numbering.
-- Replaces the date-based LM-YYYYMMDD-XXXX scheme with a perpetual sequence
-- starting at 5000. order_number is now derived from order_seq by a BEFORE
-- INSERT trigger so the application never needs to compute it.
--
-- Apply via Supabase SQL editor (Project → SQL → New query → paste → Run)
-- or via `supabase db push` if using the local CLI.

-- Sequence — nextval starts at 5000, so the first new order is 5000.
create sequence if not exists public.orders_order_seq_5000 start 5000;

-- order_seq: nullable for back-compat with existing LM- rows (they stay NULL).
-- UNIQUE allows multiple NULLs in Postgres, so old rows coexist cleanly.
alter table public.orders
  add column if not exists order_seq bigint;

alter table public.orders
  add constraint orders_order_seq_unique unique (order_seq);

-- Set default AFTER add-column so existing rows aren't backfilled with sequence
-- values (which would consume numbers we want to reserve for new orders).
alter table public.orders
  alter column order_seq set default nextval('public.orders_order_seq_5000');

alter sequence public.orders_order_seq_5000 owned by public.orders.order_seq;

-- view_token: unguessable per-order secret. Allows the confirmation page to
-- be opened by anyone holding the token in the URL even before login. We
-- always check (auth.uid() = user_id) OR (token matches) in the app.
-- gen_random_uuid() is volatile, so each existing row gets its own value.
alter table public.orders
  add column if not exists view_token uuid not null default gen_random_uuid();

-- Trigger: derive order_number from order_seq when not provided.
-- Order of evaluation: column DEFAULT (nextval) fires first, then BEFORE INSERT
-- triggers, then NOT NULL/UNIQUE checks. So NEW.order_seq is populated by the
-- time the trigger runs and order_number is set before constraint validation.
create or replace function public.set_order_number_from_seq()
returns trigger language plpgsql as $$
begin
  if new.order_seq is not null
     and (new.order_number is null or new.order_number = '') then
    new.order_number := 'SGL #' || lpad(new.order_seq::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_order_number on public.orders;

create trigger orders_set_order_number
  before insert on public.orders
  for each row execute function public.set_order_number_from_seq();
