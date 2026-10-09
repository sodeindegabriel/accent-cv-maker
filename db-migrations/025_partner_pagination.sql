-- Migration 025: Partner client list pagination and on-demand CV fetch
-- Run in Supabase SQL editor AFTER migration 018 (partner_edit_events).

-- ── Updated get_partner_clients: paginated, returns {rows, total}, no cv_english_html ──

CREATE OR REPLACE FUNCTION get_partner_clients(p_limit int DEFAULT 10, p_offset int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code text;
  v_total int;
  v_rows jsonb;
BEGIN
  SELECT p.referral_code INTO v_referral_code
  FROM partner_members pm
  JOIN partners p ON p.id = pm.partner_id
  WHERE pm.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_referral_code IS NULL THEN
    RAISE EXCEPTION 'not a partner member';
  END IF;

  SELECT COUNT(*)::int INTO v_total
  FROM candidates c
  WHERE c.referral_source = v_referral_code
    AND c.is_active = true
    AND c.user_id IS NOT NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'candidate_id', c.id,
    'display_name', CASE
      WHEN c.name IS NULL OR c.name = '' THEN 'Client ' || substring(c.id::text, 1, 6)
      WHEN length(c.name) > 0 THEN split_part(c.name, ' ', 1) || ' ' || substring(split_part(c.name, ' ', 2), 1, 1) || '.'
      ELSE 'Client ' || substring(c.id::text, 1, 6)
    END,
    'language', c.language,
    'job_types', c.job_types,
    'opted_in_at', c.opted_in_at,
    'has_cv', (c.cv_english IS NOT NULL AND c.cv_english != 'null'::jsonb)
  ) ORDER BY c.opted_in_at DESC), '[]'::jsonb) INTO v_rows
  FROM candidates c
  WHERE c.referral_source = v_referral_code
    AND c.is_active = true
    AND c.user_id IS NOT NULL
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET p_offset;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION get_partner_clients(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_partner_clients(int, int) FROM anon;
GRANT EXECUTE ON FUNCTION get_partner_clients(int, int) TO authenticated;

-- ── New get_partner_client_cv: fetches CV HTML for one candidate on-demand ──

CREATE OR REPLACE FUNCTION get_partner_client_cv(p_candidate_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code text;
  v_html text;
BEGIN
  SELECT p.referral_code INTO v_referral_code
  FROM partner_members pm
  JOIN partners p ON p.id = pm.partner_id
  WHERE pm.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_referral_code IS NULL THEN
    RAISE EXCEPTION 'not a partner member';
  END IF;

  SELECT c.cv_english->>'html' INTO v_html
  FROM candidates c
  WHERE c.id = p_candidate_id
    AND c.referral_source = v_referral_code
    AND c.is_active = true
    AND c.user_id IS NOT NULL;

  IF v_html IS NULL THEN
    RAISE EXCEPTION 'candidate not found or no CV available';
  END IF;

  RETURN v_html;
END;
$$;

REVOKE ALL ON FUNCTION get_partner_client_cv(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_partner_client_cv(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_partner_client_cv(uuid) TO authenticated;
