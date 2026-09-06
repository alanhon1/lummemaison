-- 037: reserve stock at ORDER CREATION instead of at packing.
--
-- Problem this fixes: stock was only decremented when an order first reached
-- `packaging` (see 034 + app/manzura/orders/actions.ts). Between checkout and
-- packing the units were still advertised as available, so the same item could
-- be sold several times over.
--
-- Approach: a `reserved` counter alongside the existing physical `stock`, NOT a
-- hard decrement at creation. `stock` keeps meaning "units physically on the
-- shelf" -- which the admin stock screens, procurement, the Excel export and
-- the packing auto-add all depend on -- while
--
--     available = stock - reserved
--
-- is what a new customer may buy. Packing then converts a reservation into a
-- real decrement (the units actually leave the shelf).
--
-- Lifecycle:
--   createOrder / openOrderPayment   -> reserve_stock_for_order   (reserved += q)
--   forward crossing into packaging  -> commit_reservation_for_order
--                                         (stock -= q, reserved -= q)
--   cancel/rollback BEFORE packaging -> release_reservation_for_order (reserved -= q)
--   cancel/rollback AFTER packaging  -> restore_stock_for_order   (stock += q)
--   unpaid after 7 days              -> release_expired_reservations (cron)
--
-- ⚠️ RUN ORDER (important):
--   1. Run THIS MIGRATION FIRST, before deploying the matching code.
--      The new code selects product_stock.reserved; until this migration has
--      run that column does not exist, every stock read fails, and the whole
--      catalogue renders as out of stock.
--   2. Then push/deploy the code.
--   3. Then run `npx tsx scripts/stock-reservation-backfill.ts` to see which
--      products the OLD timing left oversold, and `--apply` to reserve stock
--      for orders that are already open.
--
-- Run via the Supabase SQL editor (or supabase db push).

-- 1. Columns ---------------------------------------------------------------
alter table public.product_stock
  add column if not exists reserved integer not null default 0 check (reserved >= 0);

-- Per-order reservation flag. Makes reserve/release/commit idempotent on retry
-- and lets the expiry job find exactly which orders are holding stock. Orders
-- created BEFORE this migration keep stock_reserved = false, so their packing
-- crossing falls back to a plain decrement -- identical to today's behaviour.
alter table public.orders
  add column if not exists stock_reserved    boolean not null default false,
  add column if not exists stock_reserved_at timestamptz;

create index if not exists orders_stock_reserved_idx
  on public.orders (status, stock_reserved_at)
  where stock_reserved;

-- 2. Reserve (order creation) ----------------------------------------------
-- Atomic across every line: the whole function is one transaction, so a partial
-- reservation can never be left behind. Raises when a line cannot be covered,
-- which the caller turns into a user-facing "not enough stock" error.
--
-- items shape: [ {"product_id": 1, "quantity": 2, "option": "50ml"}, ... ]
create or replace function public.reserve_stock_for_order(p_order_id bigint, items jsonb)
returns void language plpgsql as $fn$
declare
  it jsonb;
  pid bigint;
  qty integer;
  opt text;
  affected integer;
  already boolean;
begin
  -- Idempotency: a retried call must not double-reserve. Locking the order row
  -- also serialises two concurrent submits of the same order.
  select stock_reserved into already
    from public.orders where id = p_order_id for update;
  if already is null then
    raise exception 'order % not found', p_order_id;
  end if;
  if already then
    return;
  end if;

  for it in select * from jsonb_array_elements(items) loop
    pid := (it->>'product_id')::bigint;
    qty := (it->>'quantity')::integer;
    opt := coalesce(it->>'option', '');
    if qty is null or qty <= 0 then
      raise exception 'invalid quantity for product %: %', pid, qty;
    end if;

    insert into public.product_stock (product_id, option, stock)
      values (pid, opt, 0)
      on conflict (product_id, option) do nothing;

    -- The gate: only reserve what is genuinely unspoken-for. Concurrent orders
    -- for the last unit serialise on this row update, so exactly one wins.
    update public.product_stock
       set reserved = reserved + qty
     where product_id = pid and option = opt and stock - reserved >= qty;

    get diagnostics affected = row_count;
    if affected = 0 then
      raise exception 'insufficient stock for product %/option % (need %)', pid, opt, qty;
    end if;
  end loop;

  update public.orders
     set stock_reserved = true, stock_reserved_at = now()
   where id = p_order_id;
end;
$fn$;

-- 3. Release (cancel / rollback before packing / expiry) --------------------
create or replace function public.release_reservation_for_order(p_order_id bigint, items jsonb)
returns void language plpgsql as $fn$
declare
  it jsonb;
  pid bigint;
  qty integer;
  opt text;
  held boolean;
begin
  select stock_reserved into held
    from public.orders where id = p_order_id for update;
  if held is null or not held then
    return;  -- nothing reserved (or already released) -- no-op
  end if;

  for it in select * from jsonb_array_elements(items) loop
    pid := (it->>'product_id')::bigint;
    qty := (it->>'quantity')::integer;
    opt := coalesce(it->>'option', '');
    if qty is null or qty <= 0 then
      continue;
    end if;
    -- greatest(...) guards the CHECK if history and reservations ever disagree;
    -- releasing must never fail and strand the order.
    update public.product_stock
       set reserved = greatest(0, reserved - qty)
     where product_id = pid and option = opt;
  end loop;

  update public.orders
     set stock_reserved = false, stock_reserved_at = null
   where id = p_order_id;
end;
$fn$;

-- 4. Commit (order reaches packing -- units leave the shelf) ----------------
-- Converts a reservation into a real decrement. For orders placed before this
-- migration (stock_reserved = false) it degrades to the plain floor-checked
-- decrement that 034 performed, so in-flight orders pack normally.
create or replace function public.commit_reservation_for_order(p_order_id bigint, items jsonb)
returns void language plpgsql as $fn$
declare
  it jsonb;
  pid bigint;
  qty integer;
  opt text;
  affected integer;
  held boolean;
begin
  select stock_reserved into held
    from public.orders where id = p_order_id for update;
  if held is null then
    raise exception 'order % not found', p_order_id;
  end if;

  for it in select * from jsonb_array_elements(items) loop
    pid := (it->>'product_id')::bigint;
    qty := (it->>'quantity')::integer;
    opt := coalesce(it->>'option', '');
    if qty is null or qty <= 0 then
      raise exception 'invalid quantity for product %: %', pid, qty;
    end if;

    insert into public.product_stock (product_id, option, stock)
      values (pid, opt, 0)
      on conflict (product_id, option) do nothing;

    if held then
      -- Reserved units are already spoken for by THIS order, so the floor only
      -- has to cover the physical count.
      update public.product_stock
         set stock = stock - qty, reserved = greatest(0, reserved - qty)
       where product_id = pid and option = opt and stock >= qty;
    else
      update public.product_stock
         set stock = stock - qty
       where product_id = pid and option = opt and stock >= qty;
    end if;

    get diagnostics affected = row_count;
    if affected = 0 then
      raise exception 'insufficient stock for product %/option % (need %)', pid, opt, qty;
    end if;
  end loop;

  update public.orders
     set stock_reserved = false, stock_reserved_at = null
   where id = p_order_id;
end;
$fn$;

-- 5. Restore (cancel AFTER packing) ----------------------------------------
-- Replaces the app-side read-then-write in restoreStockForItems, which could
-- lose a concurrent update. Pure +stock, no reservation involved.
create or replace function public.restore_stock_for_order(items jsonb)
returns void language plpgsql as $fn$
declare
  it jsonb;
  pid bigint;
  qty integer;
  opt text;
begin
  for it in select * from jsonb_array_elements(items) loop
    pid := (it->>'product_id')::bigint;
    qty := (it->>'quantity')::integer;
    opt := coalesce(it->>'option', '');
    if qty is null or qty <= 0 then
      continue;
    end if;

    insert into public.product_stock (product_id, option, stock)
      values (pid, opt, qty)
      on conflict (product_id, option)
      do update set stock = public.product_stock.stock + excluded.stock;
  end loop;
end;
$fn$;

-- 6. Expiry: release reservations held by unpaid orders ---------------------
-- Only statuses where the money has NOT been confirmed are eligible.
-- `payment_verified` is deliberately excluded -- we hold that customer's money,
-- so their units stay reserved no matter how long packing takes.
-- Returns the released orders so the caller can report/notify.
create or replace function public.release_expired_reservations(p_days integer default 7)
-- OUT parameters are deliberately prefixed so no name can collide with a column
-- in the queries below (plpgsql.variable_conflict defaults to `error`).
returns table (
  released_order_id     bigint,
  released_order_number text,
  released_status       text,
  released_at           timestamptz
)
language plpgsql as $fn$
declare
  r record;
begin
  for r in
    select o.id, o.order_number, o.status, o.stock_reserved_at
      from public.orders o
     where o.stock_reserved
       and o.status in ('order_received', 'awaiting_payment')
       and o.stock_reserved_at < now() - make_interval(days => p_days)
  loop
    perform public.release_reservation_for_order(
      r.id,
      (select coalesce(jsonb_agg(jsonb_build_object(
                'product_id', oi.product_id,
                'quantity',   oi.quantity,
                'option',     coalesce(oi.option, ''))), '[]'::jsonb)
         from public.order_items oi where oi.order_id = r.id)
    );
    released_order_id     := r.id;
    released_order_number := r.order_number;
    released_status       := r.status;
    released_at           := r.stock_reserved_at;
    return next;
  end loop;
end;
$fn$;

-- Daily sweep at 04:10 UTC. pg_cron is already enabled by migration 011.
create extension if not exists pg_cron;
select cron.unschedule('release-expired-stock-reservations')
  where exists (select 1 from cron.job where jobname = 'release-expired-stock-reservations');
select cron.schedule(
  'release-expired-stock-reservations',
  '10 4 * * *',
  $cron$ select public.release_expired_reservations(7); $cron$
);
