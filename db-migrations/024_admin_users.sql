-- Migration 024: Admin user listing and signup statistics
-- Run in Supabase SQL editor. Requires is_admin() from migration 014.

-- ── list_users(p_search, p_limit, p_offset) ───────────────────────────────────
-- Returns {rows: [...], total: int} for the admin users table.
-- Joins profiles + auth.users; includes referral_code and CV/cover-letter counts.
-- Search is case-insensitive on email and full_name.
-- p_limit is capped at 100 (use p_offset to page).
CREATE OR REPLACE FUNCTION list_users(
  p_search text    DEFAULT '',
  p_limit  int     DEFAULT 25,
  p_offset int     DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit_capped int;
  v_rows         jsonb;
  v_total        int;
BEGIN
  -- Admin-only: the function-level check is the real protection
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  v_limit_capped := LEAST(GREATEST(p_limit, 1), 100);

  SELECT COUNT(*)::int INTO v_total
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p_search = ''
     OR p.full_name ILIKE '%' || p_search || '%'
     OR u.email    ILIKE '%' || p_search || '%';

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      p.id,
      u.email,
      p.full_name,
      u.created_at,
      u.last_sign_in_at,
      p.preferred_ui_language,
      p.role,
      pr.referral_code,
      (SELECT COUNT(*)::int FROM cv_documents    WHERE user_id = p.id) AS cv_count,
      (SELECT COUNT(*)::int FROM cover_letters   WHERE user_id = p.id) AS cover_letter_count
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN partner_referrals pr ON pr.user_id = p.id
    WHERE p_search = ''
       OR p.full_name ILIKE '%' || p_search || '%'
       OR u.email    ILIKE '%' || p_search || '%'
    ORDER BY u.created_at DESC
    LIMIT v_limit_capped OFFSET p_offset
  ) r;

  RETURN jsonb_build_object(
    'rows',  v_rows,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION list_users(text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION list_users(text, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION list_users(text, int, int) TO authenticated;

-- ── users_signup_stats() ──────────────────────────────────────────────────────
-- Returns counts of new signups: today, last 7 days, last 30 days.
CREATE OR REPLACE FUNCTION users_signup_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  RETURN jsonb_build_object(
    'today',       (SELECT COUNT(*)::int FROM auth.users
                    WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
    'last_7_days', (SELECT COUNT(*)::int FROM auth.users
                    WHERE created_at >= now() - interval '7 days'),
    'last_30_days',(SELECT COUNT(*)::int FROM auth.users
                    WHERE created_at >= now() - interval '30 days')
  );
END;
$$;

REVOKE ALL ON FUNCTION users_signup_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION users_signup_stats() FROM anon;
GRANT EXECUTE ON FUNCTION users_signup_stats() TO authenticated;
