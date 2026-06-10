-- Every user question to the chatbot is logged here (the admin "All questions"
-- view), regardless of whether the bot answered or fell back. Distinct from
-- unanswered_questions, which stays a fallback-only triage list. user_id backs
-- the per-user usage stats (item #4).
create table if not exists chat_questions (
  id            bigserial primary key,
  question_text text        not null,
  category      text        not null default 'other',
  summary       text,
  is_fallback   boolean     not null default false,
  status        text        not null default 'pending' check (status in ('pending', 'handled')),
  user_id       uuid,
  created_at    timestamptz not null default now()
);

create index if not exists chat_questions_created_idx  on chat_questions (created_at desc);
create index if not exists chat_questions_user_idx      on chat_questions (user_id);
create index if not exists chat_questions_fallback_idx  on chat_questions (is_fallback);
