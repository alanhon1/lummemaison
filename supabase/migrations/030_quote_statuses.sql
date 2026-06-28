-- supabase/migrations/030_quote_statuses.sql
-- Allow the two bulk-quote statuses on orders.status. quote_pending: created via
-- the bulk Option B (no payment). awaiting_payment: team has set shipping/total
-- and opened payment so the customer can pay in-app.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'quote_pending', 'awaiting_payment',
    'order_received', 'payment_verified', 'packaging', 'shipped', 'delivered', 'cancelled'
  ));
