-- One-time cleanup (run in Supabase SQL editor). Deletes inbound + adjustment
-- stock movements only. Keeps order-related history (order/cancelled/
-- cancel_restock). Does NOT change product_stock numbers or the Orders/Status
-- tabs. See docs/superpowers/specs/2026-06-14-real-stock-import-and-wonder-classification-design.md
delete from public.stock_movements
where reason in ('inbound', 'adjustment');

-- Optional: drop inbound batches that no longer have any movements.
delete from public.inbound_batches ib
where not exists (
  select 1 from public.stock_movements m where m.batch_id = ib.id
);
