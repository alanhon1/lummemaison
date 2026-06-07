-- Rate limiting table for customer support chatbot
-- Tracks daily usage per anonymous session to enforce 15 questions/day limit

create table if not exists chat_usage (
  session_id text not null,
  date date not null,
  count integer not null default 0,
  primary key (session_id, date)
);
