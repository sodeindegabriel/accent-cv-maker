-- Candidates pool: structured, searchable job-seeker opt-in
-- Run in Supabase SQL editor (Dashboard → SQL editor → New query)

-- ============================================================
-- 1. is_admin() — SECURITY DEFINER helper (avoids recursive RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- 2. candidates table
-- ============================================================
CREATE TABLE IF NOT EXISTS candidates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name             text        NOT NULL,
  email            text        NOT NULL,
  phone            text,
  city             text        NOT NULL DEFAULT '',
  postcode         text,
  right_to_work    text        NOT NULL DEFAULT '',
  language         text        NOT NULL DEFAULT '',
  job_types        text[]      NOT NULL DEFAULT '{}',
  skills           text[]      NOT NULL DEFAULT '{}',
  availability     text[]      NOT NULL DEFAULT '{}',
  cv_english       jsonb,
  cv_native        jsonb,
  cv_document_id   uuid        REFERENCES cv_documents(id) ON DELETE SET NULL,
  referral_source  text,
  opted_in_at      timestamptz NOT NULL DEFAULT now(),
  is_active        boolean     NOT NULL DEFAULT true
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. GRANTs
-- ============================================================
GRANT INSERT ON candidates TO anon;
GRANT SELECT, INSERT, UPDATE ON candidates TO authenticated;

-- ============================================================
-- 4. RLS policies
-- ============================================================

-- INSERT: anyone can opt in (anon covers unauthenticated result page)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'candidates' AND policyname = 'Anyone can insert candidates'
  ) THEN
    CREATE POLICY "Anyone can insert candidates"
      ON candidates FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- SELECT own row (for dashboard status)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'candidates' AND policyname = 'Users can select own candidate row'
  ) THEN
    CREATE POLICY "Users can select own candidate row"
      ON candidates FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR is_admin());
  END IF;
END $$;

-- UPDATE own row (for opt-out: set is_active = false)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'candidates' AND policyname = 'Users can update own candidate row'
  ) THEN
    CREATE POLICY "Users can update own candidate row"
      ON candidates FOR UPDATE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 5. get_platform_stats() — public RPC, aggregate counts only
-- ============================================================
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'cv_count',        (SELECT COUNT(*) FROM cv_documents),
    'candidate_count', (SELECT COUNT(*) FROM candidates WHERE is_active = true),
    'language_count',  20
  );
$$;

GRANT EXECUTE ON FUNCTION get_platform_stats() TO anon, authenticated;
