-- Enable RLS on chat_usage so direct client access is denied.
-- The chatbot API uses the service role (bypasses RLS), so rate-limiting
-- continues to work. Anon/authenticated users cannot read or manipulate
-- other users' usage rows.
alter table public.chat_usage enable row level security;
