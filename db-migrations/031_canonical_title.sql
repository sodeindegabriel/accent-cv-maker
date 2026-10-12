-- Migration 031: add canonical_title to job_title_requests and update live list
-- canonical_title: the English version produced by Claude at approve time.
-- The live job selector uses COALESCE(canonical_title, title) so analytics
-- stay consistent even for rows approved before this migration.
-- The original typed text is preserved in the existing `title` column.

ALTER TABLE job_title_requests
  ADD COLUMN IF NOT EXISTS canonical_title text;

-- Update get_approved_job_titles() to return canonical_title (falling back to
-- title) as the display value, keeping the existing return signature.
CREATE OR REPLACE FUNCTION get_approved_job_titles()
RETURNS TABLE (title text, translations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(jtr.canonical_title, jtr.title) AS title,
    jtr.translations
  FROM job_title_requests jtr
  WHERE jtr.status = 'approved'
  ORDER BY COALESCE(jtr.canonical_title, jtr.title);
END;
$$;

REVOKE ALL ON FUNCTION get_approved_job_titles() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_approved_job_titles() FROM anon;
GRANT EXECUTE ON FUNCTION get_approved_job_titles() TO anon;
GRANT EXECUTE ON FUNCTION get_approved_job_titles() TO authenticated;
