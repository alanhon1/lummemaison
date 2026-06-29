-- 000_adhoc_base_tables.sql
-- Four tables were originally created by hand in the Supabase SQL editor and
-- never had a CREATE migration, while later migrations (027, 032) ALTER them.
-- On a clean rebuild those ALTERs would hit non-existent tables and fail, so
-- these CREATEs are numbered 000 to run FIRST (before 027/032). In the live DB
-- the tables already exist, so every statement here is an idempotent no-op.
--
-- Reconstructed from code usage (best-effort). BASE columns only — columns added
-- by later migrations are intentionally omitted so those ALTERs still apply:
--   027 adds stock_movements.option; 032 adds user_messages.url/kind/product_id.
-- Soft references (plain columns, no FKs) match this codebase's style.

-- Personal in-app inbox (also the push inbox since the notifications redesign).
create table if not exists public.user_messages (
  id         bigserial primary key,
  user_id    uuid not null,                      -- soft ref → auth.users(id)
  subject    text not null,
  body       text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists user_messages_user_id_is_read_idx on public.user_messages (user_id, is_read);
create index if not exists user_messages_user_id_created_at_idx on public.user_messages (user_id, created_at desc);

-- Stock ledger (inbound, order deductions, adjustments, restocks).
create table if not exists public.stock_movements (
  id         bigserial primary key,
  product_id bigint not null,                    -- soft ref → product_stock.product_id
  delta      integer not null,                   -- signed (e.g. -quantity on an order)
  reason     text not null,                      -- inbound|order|auto_add|cancelled|cancel_restock|adjustment
  company_id bigint,                             -- soft ref → companies(id) (nullable)
  order_id   bigint,                             -- soft ref → orders(id) (nullable)
  batch_id   bigint,                             -- soft ref → inbound_batches(id) (nullable)
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_id_idx on public.stock_movements (product_id);
create index if not exists stock_movements_order_id_idx on public.stock_movements (order_id);
create index if not exists stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index if not exists stock_movements_company_id_idx on public.stock_movements (company_id);

-- Inbound receiving batches (group a delivery from a supplier).
create table if not exists public.inbound_batches (
  id           bigserial primary key,
  company_id   bigint not null,                  -- soft ref → companies(id)
  inbound_date date not null default current_date,
  memo         text,
  created_at   timestamptz not null default now()
);
create index if not exists inbound_batches_company_id_idx on public.inbound_batches (company_id);

-- Suppliers / companies (upserted by name in app code).
create table if not exists public.companies (
  id         bigserial primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists companies_name_idx on public.companies (name);
