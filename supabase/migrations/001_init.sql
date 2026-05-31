-- Lumée Maison — initial customer + orders schema.
-- Apply via Supabase SQL editor (Project → SQL → New query → paste → Run)
-- or via `supabase db push` if using the local CLI.

create table public.customer_profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null,
  phone          text not null,
  country        text not null,        -- ISO 3166-1 alpha-2 (e.g. 'US', 'GB')
  street         text not null,
  city           text not null,
  state_province text,
  postal_code    text not null,
  fedex_account  text,                 -- USA only; null otherwise
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.orders (
  id               bigserial primary key,
  order_number     text unique not null,         -- LM-YYYYMMDD-XXXX
  user_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'pending', -- pending | paid | shipped | cancelled
  subtotal_cents   integer not null,
  shipping_cents   integer not null,
  total_cents      integer not null,
  currency         text not null default 'USD',
  shipping_address jsonb not null,                -- snapshot at order time
  customer_name    text not null,
  customer_email   text not null,
  customer_phone   text not null,
  fedex_account    text,
  payment_method   text,                          -- wise | usdt | null (not yet chosen)
  created_at       timestamptz not null default now()
);

create index orders_user_id_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);

create table public.order_items (
  id          bigserial primary key,
  order_id    bigint not null references public.orders(id) on delete cascade,
  product_id  integer not null,
  product_name text not null,
  unit_cents  integer not null,
  quantity    integer not null,
  line_cents  integer not null
);

create index order_items_order_id_idx on public.order_items (order_id);

-- updated_at trigger for customer_profiles
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger customer_profiles_updated_at
  before update on public.customer_profiles
  for each row execute function public.touch_updated_at();

-- Row Level Security — defense in depth.
-- Server actions use the service role (bypasses RLS), but customer-facing
-- reads through the anon key are confined to the signed-in user's own rows.
alter table public.customer_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "own profile read"  on public.customer_profiles
  for select using (auth.uid() = user_id);
create policy "own profile write" on public.customer_profiles
  for insert with check (auth.uid() = user_id);
create policy "own profile update" on public.customer_profiles
  for update using (auth.uid() = user_id);

create policy "own orders read" on public.orders
  for select using (auth.uid() = user_id);

create policy "own order items read" on public.order_items
  for select using (
    auth.uid() = (select user_id from public.orders where id = order_id)
  );
