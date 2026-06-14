-- Per-option stock. option = '' means the whole product (optionless), which is
-- how every existing row behaves. wonder/stock_unknown now apply per option.
--
-- ⚠️ RUN ORDER (important):
--   1. Run the 239-row import SQL (docs/.../stock-import.generated.sql) BEFORE
--      this migration — it uses `on conflict (product_id)`, which is only valid
--      while the PK is product_id alone.
--   2. Deploy the per-option-aware CODE (plan 2026-06-14-per-option-stock) — the
--      currently-deployed code upserts with `onConflict: 'product_id'`, which
--      BREAKS once the PK becomes composite. Do not run this migration until that
--      code is live.
--   3. THEN run this migration.
--   4. Then run the option-aware import for the 11 held REJUBEAU/Sungshim rows.

alter table public.product_stock
  add column if not exists option text not null default '';

-- Re-key on (product_id, option).
alter table public.product_stock drop constraint if exists product_stock_pkey;
alter table public.product_stock add primary key (product_id, option);

alter table public.stock_movements
  add column if not exists option text not null default '';

-- Option-aware decrement. items: [{product_id, quantity, option?}, ...]
-- option defaults to '' so callers that don't send option keep working.
create or replace function public.decrement_stock_for_order(items jsonb)
returns void language plpgsql as $$
declare
  it jsonb;
  pid bigint;
  qty integer;
  opt text;
  affected integer;
begin
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

    update public.product_stock
       set stock = stock - qty
     where product_id = pid and option = opt;

    get diagnostics affected = row_count;
    if affected = 0 then
      raise exception 'product %/option % not found in stock table', pid, opt;
    end if;
  end loop;
end;
$$;
