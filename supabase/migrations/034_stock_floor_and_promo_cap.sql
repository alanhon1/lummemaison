-- 034_stock_floor_and_promo_cap.sql
-- Audit follow-up (correctness hardening):
--  1. decrement_stock_for_order must never drive stock negative. The app has a
--     check-then-act oversell guard, but two concurrent packaging crossings can
--     both pass it; the DB is the only place to make it atomic. Add a floor.
--  2. increment_promo_used_count must not push used_count past max_uses, and the
--     caller now awaits its result, so make the increment cap-aware and report
--     whether it actually counted.

-- 1) Option-aware decrement WITH a non-negative floor.
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

    -- Floor: only deduct when enough stock is on hand. row_count = 0 means the
    -- row was missing OR stock < qty; we distinguish below.
    update public.product_stock
       set stock = stock - qty
     where product_id = pid and option = opt and stock >= qty;

    get diagnostics affected = row_count;
    if affected = 0 then
      raise exception 'insufficient stock for product %/option % (need %)', pid, opt, qty;
    end if;
  end loop;
end;
$$;

-- 2) Cap-aware promo increment. Returns true only if it actually incremented
-- (code exists and was below its max_uses, or has no cap).
create or replace function increment_promo_used_count(p_code text)
returns boolean language plpgsql as $$
declare
  affected integer;
begin
  update promo_codes
     set used_count = used_count + 1
   where lower(code) = lower(p_code)
     and (max_uses is null or used_count < max_uses);
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
