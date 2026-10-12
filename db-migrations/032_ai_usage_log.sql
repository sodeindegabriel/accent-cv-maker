-- Migration 032: AI usage rate-limiting table and reservation function
-- Run in Supabase SQL editor. No grants to anon or authenticated on the
-- table itself — all access goes through the SECURITY DEFINER function.

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_user_kind_at
  ON ai_usage_log (user_id, kind, created_at);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
-- No RLS policies — table is accessed only via SECURITY DEFINER function below.

-- ── Rate-limit reservation function ──────────────────────────────────────────
-- Checks hourly and daily counts per user+kind; inserts a row if under limit.
-- Admins are exempt. Raises 'rate_limited' if over limit.
--
-- Limits:
--   cv          : 8 / hour,  25 / day
--   cover_letter: 10 / hour, 25 / day

CREATE OR REPLACE FUNCTION ai_usage_reserve(p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_hourly    int;
  v_daily     int;
  v_lim_hour  int;
  v_lim_day   int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Admins are exempt from rate limits
  IF (SELECT is_admin()) THEN
    RETURN;
  END IF;

  -- Set limits per kind
  CASE p_kind
    WHEN 'cv' THEN
      v_lim_hour := 8;
      v_lim_day  := 25;
    WHEN 'cover_letter' THEN
      v_lim_hour := 10;
      v_lim_day  := 25;
    ELSE
      v_lim_hour := 5;
      v_lim_day  := 20;
  END CASE;

  -- Count recent usage
  SELECT COUNT(*) INTO v_hourly
  FROM ai_usage_log
  WHERE user_id = v_uid
    AND kind = p_kind
    AND created_at > now() - INTERVAL '1 hour';

  IF v_hourly >= v_lim_hour THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT COUNT(*) INTO v_daily
  FROM ai_usage_log
  WHERE user_id = v_uid
    AND kind = p_kind
    AND created_at > now() - INTERVAL '24 hours';

  IF v_daily >= v_lim_day THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  -- Reserve a slot
  INSERT INTO ai_usage_log (user_id, kind) VALUES (v_uid, p_kind);
END;
$$;

REVOKE ALL ON FUNCTION ai_usage_reserve(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION ai_usage_reserve(text) FROM anon;
GRANT EXECUTE ON FUNCTION ai_usage_reserve(text) TO authenticated;
