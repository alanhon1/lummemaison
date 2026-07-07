-- 036: referral signup attribution.
-- The first-touch referral cookie (?ref=<code>, see 035) is stamped onto the
-- customer profile at signup, so the admin referrals page can list who joined
-- via each influencer link. Signups only — logins are not recorded.
-- Run via the Supabase SQL editor.

alter table customer_profiles add column if not exists referral_code text;

create index if not exists customer_profiles_referral_code_idx
  on customer_profiles (referral_code) where referral_code is not null;
