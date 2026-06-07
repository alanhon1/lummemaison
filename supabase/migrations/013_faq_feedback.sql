-- FAQ feedback — separate from order feedback (no order_id)
create table if not exists faq_feedback (
  id bigserial primary key,
  faq_number integer not null,
  rating text not null check (rating in ('up', 'down')),
  comment text check (char_length(comment) <= 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index faq_feedback_created_idx on faq_feedback (created_at desc);
