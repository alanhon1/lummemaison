-- Phase 7: inventory tracking.
--
-- products themselves live in data/products.json (catalogue is static). Stock
-- is the only piece that mutates per-order, so we keep it in its own table
-- keyed by the product id from the JSON file.
--
-- Rows are created lazily — a product without a row is treated as stock = 0
-- by the read helper. Admin can upsert a row via /manzura/products/[id].

create table if not exists public.product_stock (
  product_id bigint primary key,
  stock      integer not null default 0 check (stock >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_product_stock_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_stock_updated_at on public.product_stock;
create trigger product_stock_updated_at
  before update on public.product_stock
  for each row execute function public.touch_product_stock_updated_at();

-- RLS: anyone can read (catalogue needs stock to render SOLD OUT badges).
-- Writes are server-only — service role bypasses RLS, so we don't define a
-- write policy. The anon key cannot insert/update.
alter table public.product_stock enable row level security;

drop policy if exists "stock public read" on public.product_stock;
create policy "stock public read" on public.product_stock
  for select using (true);

-- Atomic decrement: iterate the items array, subtract per row, raise on
-- insufficient stock so the whole transaction rolls back. The CHECK(stock >= 0)
-- constraint is the actual gate — UPDATE will fail with a check_violation if
-- a row would go negative.
--
-- items shape:  [ {"product_id": 1, "quantity": 2}, {"product_id": 7, "quantity": 1}, ... ]
create or replace function public.decrement_stock_for_order(items jsonb)
returns void language plpgsql as $$
declare
  it jsonb;
  pid bigint;
  qty integer;
  affected integer;
begin
  for it in select * from jsonb_array_elements(items) loop
    pid := (it->>'product_id')::bigint;
    qty := (it->>'quantity')::integer;
    if qty is null or qty <= 0 then
      raise exception 'invalid quantity for product %: %', pid, qty;
    end if;

    -- Insert a 0-stock row if missing so the UPDATE below has something to
    -- act on. This keeps the failure path uniform (always check_violation).
    insert into public.product_stock (product_id, stock)
      values (pid, 0)
      on conflict (product_id) do nothing;

    update public.product_stock
       set stock = stock - qty
     where product_id = pid;

    get diagnostics affected = row_count;
    if affected = 0 then
      raise exception 'product % not found in stock table', pid;
    end if;
  end loop;
end;
$$;
