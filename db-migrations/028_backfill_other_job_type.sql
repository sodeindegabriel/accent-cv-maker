-- Migration 028: Backfill "other" job type with typed custom text
-- Review before running. Safe to run multiple times (WHERE guards limit scope).

-- ── 1. Fix cv_documents.title ─────────────────────────────────────────────────
-- Replaces the literal " — other" (or "other, ..." / "..., other") in the title
-- with the typed text from form_data->>'otherJobType', where available.

UPDATE cv_documents
SET title = REPLACE(
  title,
  'other',
  TRIM(form_data->>'otherJobType')
)
WHERE
  title ILIKE '%other%'
  AND form_data->>'otherJobType' IS NOT NULL
  AND TRIM(form_data->>'otherJobType') <> '';

-- ── 2. Fix candidates.job_types ───────────────────────────────────────────────
-- For each candidate whose job_types array contains 'other', replaces the
-- 'other' element with the typed text from the most recent cv_documents row
-- for that user (form_data->>'otherJobType').

UPDATE candidates c
SET job_types = (
  SELECT array_agg(
    CASE
      WHEN elem = 'other'
        AND TRIM(d.form_data->>'otherJobType') <> ''
      THEN TRIM(d.form_data->>'otherJobType')
      ELSE elem
    END
  )
  FROM unnest(c.job_types) AS elem
  CROSS JOIN LATERAL (
    SELECT form_data
    FROM cv_documents
    WHERE user_id = c.user_id
      AND form_data->>'otherJobType' IS NOT NULL
      AND TRIM(form_data->>'otherJobType') <> ''
    ORDER BY created_at DESC
    LIMIT 1
  ) d
)
WHERE
  'other' = ANY(c.job_types)
  AND EXISTS (
    SELECT 1
    FROM cv_documents
    WHERE user_id = c.user_id
      AND form_data->>'otherJobType' IS NOT NULL
      AND TRIM(form_data->>'otherJobType') <> ''
  );
