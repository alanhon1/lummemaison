# Notifications — Phase 2 implementation plan

Spec: `docs/superpowers/specs/2026-06-29-notifications-system-design.md` (§Phase 2).
Builds on Phase 1 (commit `988f958`). Branch: `feat/notifications-phase2`.

**Locked decision (this session):** admin *order* notification = **in-app admin
inbox + badge only** (no admin Web Push yet — that needs a separate admin
subscription flow, deferred to Phase 3).

## Pieces

### T1 — migration 033: `admin_notifications`
New table for the admin inbox (orders + future system events).
Columns: `id`, `kind` (default `order`), `title`, `body`, `url`, `order_id`,
`is_read` (default false), `created_at`. Partial-friendly index on
`(is_read, created_at desc)`. Owner runs it in Supabase before deploy.

### T2 — notify helpers (`lib/push/notify.ts`)
- `notifyAdmin({title, body?, url?, kind?, orderId?})` — best-effort insert one
  `admin_notifications` row. Never throws.
- Reuse existing `notifyUsers` for customer broadcasts.

### T3 — order-received → admin notification (`app/[locale]/checkout/actions.ts`)
Fire `notifyAdmin` after a real order is created (both the quote branch and the
normal order branch), skipping TEST orders. url → `/manzura/orders/<id>`.
Best-effort; must never break checkout.

### T4 — admin notify API (`/api/admin/notify`, POST, iron-session)
Body: `{ type: 'product' | 'custom', ... }`.
- `product`: `{ productId, productName, subtype: 'new'|'restock'|'benefit', note? }`
  → build title/body, `url = /product/<id>`, `kind='product'`, `productId` →
  `notifyUsers`.
- `custom`: `{ title, body, url? }` → `notifyUsers` (kind `announcement`).
Returns `{ ok, users, pushed }`. General announcements stay in the Announcements
page (already pushes in Phase 1) — composer covers the two without a home.

### T5 — admin notification composer (`/manzura/notifications`)
Client component `NotificationComposer` with Product / Custom tabs. Product tab
gets a product picker (list of `{id,name}` passed from the server page) + subtype
radios + optional note + live preview. Custom tab: title/body/link. POSTs to
`/api/admin/notify`, shows the send result.

### T6 — admin inbox + read state (`/manzura/notifications`)
Server page lists `admin_notifications` (desc), renders order items as links to
the order. On view, mark all unread read (mirrors the user inbox pattern). Page
becomes the hub: inbox (top) + composer + link to diagnostics.

### T7 — unread badge
- `/api/admin/notifications/unread-count` (GET, iron-session).
- `AdminNav` top bar: a Bell button → `/manzura/notifications` with an unread
  count badge (client fetch, light poll). Dashboard "Notifications" button also
  shows the count.

### T8 — product-create "notify users?" popup (`ProductEditClient`)
After a successful NEW-product create, show a modal "Notify users about this new
product?" → Yes posts `{type:'product', subtype:'new', productId, productName}`
to `/api/admin/notify`; Skip just continues. Either way → navigate to the new
product.

## Verify
- `tsc --noEmit` + `next build` clean.
- Composer Product/Custom send → ON user gets banner + inbox (deep-link works).
- New product save → popup → push reaches device; Skip sends nothing.
- Placing an order creates an admin_notifications row → appears in admin inbox,
  badge increments, opening the page clears it.
- TEST orders create no admin notification.

## Deploy
Owner runs migration 033, then says "deploy" → merge `feat/notifications-phase2`
→ main (matches Phase 1 workflow).
