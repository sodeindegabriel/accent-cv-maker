-- Migration 029: add source_language to job_title_requests
-- Tracks the user's CV language at the time of the request, to assist admin
-- translation when approving custom job titles.
-- Run in Supabase SQL editor.

ALTER TABLE job_title_requests
  ADD COLUMN IF NOT EXISTS source_language text;

-- Update the upsert helper to accept and store source_language.
-- On conflict (normalized_title) we do NOT overwrite source_language — first
-- submission wins, which is the most meaningful data point.
CREATE OR REPLACE FUNCTION upsert_job_title_request(
  p_title           text,
  p_normalized      text,
  p_source_language text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO job_title_requests
    (title, normalized_title, request_count, first_requested_at, last_requested_at, source_language)
  VALUES
    (p_title, p_normalized, 1, now(), now(), p_source_language)
  ON CONFLICT (normalized_title) DO UPDATE
    SET request_count      = job_title_requests.request_count + 1,
        last_requested_at  = now();
  -- Note: source_language is not overwritten on conflict (first submission wins)
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_job_title_request(text, text, text) TO authenticated;
