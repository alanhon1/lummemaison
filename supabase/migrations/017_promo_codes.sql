create table if not exists promo_codes (
  id             bigserial primary key,
  code           text unique not null,
  description    text,
  discount_type  text check (discount_type in ('percent', 'fixed')),
  discount_value integer not null,        -- percent: 0-100, fixed: cents
  min_order_cents integer not null default 0,
  max_uses       integer,                 -- null = unlimited
  used_count     integer not null default 0,
  active         boolean not null default true,
  expires_at     timestamptz,
  notes          text,
  created_at     timestamptz not null default now()
);

create index promo_codes_code_idx on promo_codes (lower(code));
create index promo_codes_active_idx on promo_codes (active);

-- Atomically increment used_count for a promo code (called at order creation).
-- Silently does nothing if the code doesn't exist.
create or replace function increment_promo_used_count(p_code text)
returns void language plpgsql as $$
begin
  update promo_codes
  set used_count = used_count + 1
  where lower(code) = lower(p_code);
end;
$$;
