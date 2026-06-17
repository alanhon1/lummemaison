-- Customer demand requests for out-of-stock products. When a product hits 0
-- stock the buy button is disabled and customers can instead "make a request"
-- stating how many units they want, so the owner can gauge demand before
-- restocking. All access goes through the service-role server path (the admin
-- Requests page + the public submit server action), so RLS is on with no policy.
create table if not exists public.product_requests (
  id             bigserial primary key,
  product_id     integer not null,
  product_name   text not null,
  option         text,
  quantity       integer not null check (quantity > 0 and quantity <= 100000),
  user_id        uuid,
  customer_email text,
  customer_name  text,
  status         text not null default 'open' check (status in ('open', 'resolved')),
  created_at     timestamptz not null default now()
);

create index if not exists product_requests_status_idx
  on public.product_requests (status, created_at desc);

alter table public.product_requests enable row level security;
