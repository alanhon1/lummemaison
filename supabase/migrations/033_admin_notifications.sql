-- 033_admin_notifications.sql
-- Phase 2 of the notifications redesign. An admin-only inbox: order-received
-- events (and future system events) land here so the owner sees them in
-- /manzura/notifications with an unread badge. Web Push for admin is deferred to
-- Phase 3 (needs a separate admin subscription flow), so this is in-app only.
create table if not exists public.admin_notifications (
  id bigint generated always as identity primary key,
  kind text not null default 'order',     -- order | system  (free text; enforced in app)
  title text not null,
  body text not null default '',
  url text,                                -- click-through (e.g. /manzura/orders/<id>)
  order_id bigint,                         -- soft link; not an FK so order deletes don't cascade
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- The badge query is "unread, newest first"; index it.
create index if not exists admin_notifications_unread_idx
  on public.admin_notifications (is_read, created_at desc);
