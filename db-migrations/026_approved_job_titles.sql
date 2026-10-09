-- Migration 026: Get approved job titles for live display
-- Run in Supabase SQL editor AFTER migration 010 (job_title_requests).

CREATE OR REPLACE FUNCTION get_approved_job_titles()
RETURNS TABLE (title text, translations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT jtr.title, jtr.translations
  FROM job_title_requests jtr
  WHERE jtr.status = 'approved'
  ORDER BY jtr.title;
END;
$$;

REVOKE ALL ON FUNCTION get_approved_job_titles() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_approved_job_titles() FROM anon;
GRANT EXECUTE ON FUNCTION get_approved_job_titles() TO anon;
GRANT EXECUTE ON FUNCTION get_approved_job_titles() TO authenticated;
