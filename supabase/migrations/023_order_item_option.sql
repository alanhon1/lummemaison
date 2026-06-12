-- 023: Per-line purchase option on order items.
--
-- Some products (e.g. REJUBEAU meso needles) are bought with a chosen variant
-- like a length (4mm / 6mm / 13mm) that is NOT a separate product. The customer
-- picks it at add-to-cart time; it must be recorded on the order line and shown
-- after the product name everywhere the order is displayed.
--
-- Nullable + additive: existing rows and non-option products keep NULL. The
-- option is captured server-side at order creation (checkout actions).

alter table public.order_items
  add column if not exists option text;
