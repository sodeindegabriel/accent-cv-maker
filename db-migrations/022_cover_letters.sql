-- Migration 022: cover_letters table
-- Run in Supabase SQL editor after migration 021.

-- ── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cover_letters (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  cv_document_id  uuid        REFERENCES cv_documents ON DELETE SET NULL,
  mode            text        NOT NULL CHECK (mode IN ('advert', 'speculative')),
  job_title       text,
  company         text,
  advert_text     text,
  answers         jsonb,
  length          text,
  language        text,
  english_text    text,
  native_text     text,
  gaps            jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 2. updated_at trigger ────────────────────────────────────────────────────
-- set_updated_at() function was created in migration 021; reuse it.
DROP TRIGGER IF EXISTS cover_letters_updated_at ON cover_letters;
CREATE TRIGGER cover_letters_updated_at
  BEFORE UPDATE ON cover_letters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. Usage-cap helper function ─────────────────────────────────────────────
-- Returns the cover letter limit for a given user.
-- Default: 3.  Standard/premium subscribers or any partner-referred users: 20.
-- Admins (via is_admin()): exempt (returns a very large number).
CREATE OR REPLACE FUNCTION cover_letter_limit(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tier   text;
  v_admin  boolean;
  v_referred boolean;
BEGIN
  -- Admin check first
  SELECT is_admin() INTO v_admin;
  IF v_admin THEN RETURN 1000000; END IF;

  -- Subscription tier
  SELECT subscription_tier INTO v_tier
  FROM profiles
  WHERE id = p_user_id;

  IF v_tier IN ('standard', 'premium') THEN RETURN 20; END IF;

  -- Any partner referral
  SELECT EXISTS (
    SELECT 1 FROM partner_referrals WHERE user_id = p_user_id LIMIT 1
  ) INTO v_referred;

  IF v_referred THEN RETURN 20; END IF;

  RETURN 3;
END;
$$;

-- ── 4. BEFORE INSERT trigger enforcing the cap ───────────────────────────────
CREATE OR REPLACE FUNCTION check_cover_letter_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_count integer;
  v_limit integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM cover_letters
  WHERE user_id = NEW.user_id;

  SELECT cover_letter_limit(NEW.user_id) INTO v_limit;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'cover_letter_limit_reached' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cover_letter_limit ON cover_letters;
CREATE TRIGGER enforce_cover_letter_limit
  BEFORE INSERT ON cover_letters
  FOR EACH ROW EXECUTE FUNCTION check_cover_letter_limit();

-- ── 5. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own rows
CREATE POLICY "users manage own cover letters"
  ON cover_letters FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all rows (separate policy to avoid subquery on same table)
CREATE POLICY "admins read all cover letters"
  ON cover_letters FOR SELECT
  TO authenticated
  USING (is_admin());

-- ── 6. Remaining-count helper function ───────────────────────────────────────
-- Returns how many cover letters the calling user can still generate (minimum 0).
-- Uses auth.uid() internally — never accepts a user_id parameter.
CREATE OR REPLACE FUNCTION cover_letters_remaining()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_used  integer;
  v_limit integer;
BEGIN
  SELECT COUNT(*) INTO v_used
  FROM cover_letters
  WHERE user_id = auth.uid();

  SELECT cover_letter_limit(auth.uid()) INTO v_limit;

  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

GRANT EXECUTE ON FUNCTION cover_letters_remaining() TO authenticated;

-- ── 7. Grants ────────────────────────────────────────────────────────────────
-- Required alongside RLS — silent 403s occur without explicit grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON cover_letters TO authenticated;
