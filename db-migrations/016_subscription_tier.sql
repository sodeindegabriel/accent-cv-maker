-- Add subscription_tier to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'standard', 'premium'));

-- Backfill existing rows (already covered by DEFAULT, but explicit for clarity)
UPDATE profiles SET subscription_tier = 'free' WHERE subscription_tier IS NULL;
