create table if not exists faqs (
  id           bigserial primary key,
  question     text not null,
  answer       text not null,
  category     text not null default 'other',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unanswered_id bigint references unanswered_questions(id) on delete set null
);

create index faqs_active_idx on faqs (active);
