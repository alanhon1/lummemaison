-- 035: influencer referral links.
-- ?ref=<code> landings are counted per code and stamped onto orders placed
-- while the (first-touch, 30-day) referral cookie is present. Rewards are
-- manual, so this is tracking only — no payout logic.
-- Run via the Supabase SQL editor (or supabase db push).

create table if not exists referral_codes (
  id              bigserial primary key,
  code            text unique not null,          -- stored lowercase; matching is case-insensitive
  influencer_name text not null,
  notes           text,
  clicks          integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists referral_codes_code_idx on referral_codes (lower(code));

-- Only the service role (admin pages + /api/ref/track) touches this table;
-- RLS with no policies keeps the influencer list invisible to the anon key.
alter table referral_codes enable row level security;

alter table orders add column if not exists referral_code text;
create index if not exists orders_referral_code_idx on orders (referral_code) where referral_code is not null;

-- Atomically count a landing on ?ref=<code>. No-op for unknown/inactive codes.
create or replace function increment_referral_clicks(p_code text)
returns void language plpgsql as $$
begin
  update referral_codes
  set clicks = clicks + 1
  where lower(code) = lower(p_code) and active;
end;
$$;

-- Seed the launch influencers.
insert into referral_codes (code, influencer_name)
values ('missabby', 'MissAbby'), ('annette', 'Annette')
on conflict (code) do nothing;
