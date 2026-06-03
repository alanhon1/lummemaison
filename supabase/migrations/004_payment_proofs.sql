-- Phase 5: payment proof + transaction link.
--
-- payment_proof_path   — Supabase Storage path within the private
--   `payment-proofs` bucket (e.g. "<user-id>/<uuid>.jpg"). The orders table
--   stores the path, never a signed URL — URLs expire and we want to mint a
--   fresh one each time the admin views an order.
-- payment_transaction_link — Wise/USDT transaction URL the customer pasted in,
--   used when they cannot upload a screenshot (or as a complement to it).
-- Phase 5 also moves new orders straight to 'processing' once a proof or
-- transaction link is supplied; the column already allows arbitrary text.

alter table public.orders
  add column if not exists payment_proof_path text,
  add column if not exists payment_transaction_link text;

-- Storage bucket itself must be created via the helper script
-- `scripts/ensure-payment-proofs-bucket.ts` (`npm run setup:storage`). It is
-- intentionally not created here so the migration stays SQL-only.
