create table if not exists unanswered_questions (
  id         bigserial primary key,
  question_text text not null,
  category   text not null default 'other',
  summary    text,
  status     text not null default 'pending' check (status in ('pending', 'handled')),
  created_at timestamptz not null default now()
);

create index unanswered_questions_status_idx on unanswered_questions (status);
create index unanswered_questions_created_idx on unanswered_questions (created_at desc);
