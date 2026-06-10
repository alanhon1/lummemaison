-- Customer-uploaded order photos (#8): up to 3 per order, each with an optional
-- short comment. Files live in the private `order-attachments` Storage bucket;
-- this table holds the metadata. Visible to the customer (their own orders) and
-- to admin (service role).
create table if not exists order_attachments (
  id           bigserial   primary key,
  order_id     bigint      not null references orders(id) on delete cascade,
  storage_path text        not null,
  comment      text,
  created_at   timestamptz not null default now()
);

create index if not exists order_attachments_order_idx on order_attachments (order_id);

alter table order_attachments enable row level security;

-- Customers can read attachments on their own orders. Writes go through server
-- actions using the service role (which bypasses RLS).
create policy "own order attachments read" on order_attachments
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_attachments.order_id and o.user_id = auth.uid()
    )
  );
