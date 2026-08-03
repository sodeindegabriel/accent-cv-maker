-- Migration 010: job_title_requests — capture & review custom "other" job titles
-- Run in Supabase SQL editor.

-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_title_requests (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title              text        NOT NULL,
  normalized_title   text        NOT NULL UNIQUE,
  request_count      int         NOT NULL DEFAULT 1,
  first_requested_at timestamptz NOT NULL DEFAULT now(),
  last_requested_at  timestamptz NOT NULL DEFAULT now(),
  status             text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  translations       jsonb
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE job_title_requests ENABLE ROW LEVEL SECURITY;

-- Auth note: job type selection (Step 2) comes AFTER Step 0 auth, so all
-- inserts fire from authenticated users. anon access is intentionally excluded.
CREATE POLICY "authenticated users can insert job_title_requests"
  ON job_title_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT and UPDATE are restricted to admins via the existing is_admin() function.
CREATE POLICY "admins can select job_title_requests"
  ON job_title_requests
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "admins can update job_title_requests"
  ON job_title_requests
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── Base grants (required alongside RLS or silent 403s occur) ────────────────
GRANT SELECT, INSERT, UPDATE ON job_title_requests TO authenticated;

-- ── Upsert helper function ───────────────────────────────────────────────────
-- Increments request_count on conflict instead of overwriting, which a plain
-- client-side upsert cannot do atomically.
CREATE OR REPLACE FUNCTION upsert_job_title_request(p_title text, p_normalized text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO job_title_requests
    (title, normalized_title, request_count, first_requested_at, last_requested_at)
  VALUES
    (p_title, p_normalized, 1, now(), now())
  ON CONFLICT (normalized_title) DO UPDATE
    SET request_count      = job_title_requests.request_count + 1,
        last_requested_at  = now();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_job_title_request(text, text) TO authenticated;
