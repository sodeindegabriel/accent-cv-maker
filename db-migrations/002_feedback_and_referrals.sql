-- Feedback + partner referrals tables
-- Run in Supabase SQL editor (Dashboard → SQL editor → New query)

-- ============================================================
-- 1. partner_referrals — attribution on signup
-- ============================================================
CREATE TABLE IF NOT EXISTS partner_referrals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_name  text NOT NULL,
  referral_code text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON partner_referrals TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partner_referrals' AND policyname = 'Users can insert own partner_referrals'
  ) THEN
    CREATE POLICY "Users can insert own partner_referrals"
      ON partner_referrals FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partner_referrals' AND policyname = 'Admins can select all partner_referrals'
  ) THEN
    CREATE POLICY "Admins can select all partner_referrals"
      ON partner_referrals FOR SELECT TO authenticated
      USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

-- ============================================================
-- 2. feedback — user-submitted ratings and comments
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating     int  CHECK (rating >= 1 AND rating <= 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON feedback TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Users can insert feedback'
  ) THEN
    CREATE POLICY "Users can insert feedback"
      ON feedback FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Admins can select all feedback'
  ) THEN
    CREATE POLICY "Admins can select all feedback"
      ON feedback FOR SELECT TO authenticated
      USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

-- ============================================================
-- 3. Admin SELECT policies on existing tables
--    (additive — existing user-own policies remain)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admins can select all profiles'
  ) THEN
    CREATE POLICY "Admins can select all profiles"
      ON profiles FOR SELECT TO authenticated
      USING ((SELECT role FROM profiles p2 WHERE p2.id = auth.uid()) = 'admin'
             OR id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cv_documents' AND policyname = 'Admins can select all cv_documents'
  ) THEN
    CREATE POLICY "Admins can select all cv_documents"
      ON cv_documents FOR SELECT TO authenticated
      USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
             OR user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'downloads' AND policyname = 'Admins can select all downloads'
  ) THEN
    CREATE POLICY "Admins can select all downloads"
      ON downloads FOR SELECT TO authenticated
      USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
             OR user_id = auth.uid());
  END IF;
END $$;
