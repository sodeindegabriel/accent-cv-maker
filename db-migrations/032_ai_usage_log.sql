-- Migration 034: AI usage ledger and rate limiting
-- Supports the server-side checks added to CV and cover letter generation.
-- Clients never read or write ai_usage_log directly; only ai_usage_reserve()
-- touches it.

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_user_kind_time_idx
  ON ai_usage_log (user_id, kind, created_at DESC);

-- RLS on with no policies and no client grants: closed to everyone but the
-- SECURITY DEFINER function below.
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai_usage_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION ai_usage_reserve(p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_hour_limit int;
  v_day_limit  int;
  v_hour_count int;
  v_day_count  int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_kind IS NULL OR char_length(p_kind) < 1 OR char_length(p_kind) > 40 THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  -- Serialise concurrent calls for the same user and kind so a burst of
  -- parallel requests cannot all slip under the limit together.
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || p_kind));

  -- Keep the table small: drop this user's entries older than 7 days.
  DELETE FROM ai_usage_log
  WHERE user_id = v_uid AND created_at < now() - interval '7 days';

  -- Admins are logged but never limited.
  IF is_admin() THEN
    INSERT INTO ai_usage_log (user_id, kind) VALUES (v_uid, p_kind);
    RETURN;
  END IF;

  IF p_kind = 'cover_letter' THEN
    v_hour_limit := 10;
    v_day_limit  := 25;
  ELSE
    v_hour_limit := 8;
    v_day_limit  := 25;
  END IF;

  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
    count(*)
  INTO v_hour_count, v_day_count
  FROM ai_usage_log
  WHERE user_id = v_uid
    AND kind = p_kind
    AND created_at > now() - interval '24 hours';

  IF v_hour_count >= v_hour_limit OR v_day_count >= v_day_limit THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO ai_usage_log (user_id, kind) VALUES (v_uid, p_kind);
END;
$$;

REVOKE ALL ON FUNCTION ai_usage_reserve(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ai_usage_reserve(text) TO authenticated, service_role;
