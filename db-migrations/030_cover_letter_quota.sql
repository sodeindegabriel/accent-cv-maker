-- Migration 030: cover_letter_quota() — returns {used, limit} for the current user
-- Run AFTER migration 022 where cover_letters table and cover_letters_remaining() exist.

CREATE OR REPLACE FUNCTION cover_letter_quota()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit  int;
  v_used   int;
BEGIN
  SELECT COUNT(*)::int INTO v_used
  FROM cover_letters
  WHERE user_id = auth.uid();

  -- Mirror the same limit logic as cover_letters_remaining / cover_letter_limit
  SELECT cover_letter_limit(auth.uid()) INTO v_limit;

  RETURN jsonb_build_object('used', v_used, 'limit', v_limit);
END;
$$;

REVOKE ALL ON FUNCTION cover_letter_quota() FROM PUBLIC;
REVOKE ALL ON FUNCTION cover_letter_quota() FROM anon;
GRANT EXECUTE ON FUNCTION cover_letter_quota() TO authenticated;
