-- 032_notifications_phase1.sql
-- Phase 1 of the notifications redesign. Reuse user_messages as the personal
-- push inbox: add a click-through url, a kind tag, and an optional product link.
-- Existing rows default to kind='message', url null → they render unchanged.
alter table public.user_messages
  add column if not exists url text,
  add column if not exists kind text not null default 'message',
  add column if not exists product_id integer;

-- kind ∈ message | announcement | product | system  (free text; enforced in app)
