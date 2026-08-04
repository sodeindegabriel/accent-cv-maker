-- Migration 013: cap partner team members at 2 (owner + 1 editor);
-- also return member_count from get_partner_dashboard_data().
-- Run in Supabase SQL editor AFTER migration 012.

-- ── invite_partner_member() — UPDATED ────────────────────────────────────────
-- Added: reject if partner already has 2 or more members.
CREATE OR REPLACE FUNCTION invite_partner_member(p_partner_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_member_count int;
BEGIN
  SELECT role INTO v_caller_role
  FROM partner_members
  WHERE partner_id = p_partner_id AND user_id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only owners can invite team members';
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM partner_members
  WHERE partner_id = p_partner_id;

  IF v_member_count >= 2 THEN
    RAISE EXCEPTION 'Team member limit reached (2 members maximum per partner)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM partner_members
    WHERE partner_id = p_partner_id AND email = lower(p_email)
  ) THEN
    RAISE EXCEPTION 'This email is already a member of this partner';
  END IF;

  INSERT INTO partner_members (partner_id, email, role)
  VALUES (p_partner_id, lower(p_email), 'editor');
END;
$$;

GRANT EXECUTE ON FUNCTION invite_partner_member(uuid, text) TO authenticated;

-- ── get_partner_dashboard_data() — UPDATED ───────────────────────────────────
-- Added: member_count in the returned JSON so the dashboard UI can gate
-- the invite form before the user even submits.
CREATE OR REPLACE FUNCTION get_partner_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner       partners%ROWTYPE;
  v_member_role   text;
  v_member_count  int;
  v_total_cvs     int;
  v_month_cvs     int;
  v_candidates    int;
  v_lang_breakdown    jsonb;
  v_job_breakdown     jsonb;
  v_recent_candidates jsonb;
BEGIN
  SELECT p.*, pm.role INTO v_partner.id, v_partner.user_id, v_partner.name,
    v_partner.email, v_partner.referral_code, v_partner.is_active,
    v_partner.created_at, v_member_role
  FROM partner_members pm
  JOIN partners p ON p.id = pm.partner_id
  WHERE pm.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_partner.id IS NULL THEN RETURN NULL; END IF;

  SELECT COUNT(*)::int INTO v_member_count
  FROM partner_members WHERE partner_id = v_partner.id;

  SELECT COUNT(*)::int INTO v_total_cvs
  FROM cv_documents cd
  JOIN partner_referrals pr ON pr.user_id = cd.user_id
  WHERE pr.referral_code = v_partner.referral_code;

  SELECT COUNT(*)::int INTO v_month_cvs
  FROM cv_documents cd
  JOIN partner_referrals pr ON pr.user_id = cd.user_id
  WHERE pr.referral_code = v_partner.referral_code
    AND cd.created_at >= date_trunc('month', now());

  SELECT COUNT(*)::int INTO v_candidates
  FROM candidates
  WHERE referral_source = v_partner.referral_code AND is_active = true;

  SELECT jsonb_object_agg(lang, cnt) INTO v_lang_breakdown
  FROM (
    SELECT language AS lang, COUNT(*)::int AS cnt
    FROM candidates
    WHERE referral_source = v_partner.referral_code AND is_active = true
    GROUP BY language ORDER BY cnt DESC LIMIT 10
  ) sub;

  SELECT jsonb_object_agg(jt, cnt) INTO v_job_breakdown
  FROM (
    SELECT jt, COUNT(*)::int AS cnt
    FROM candidates, unnest(job_types) AS jt
    WHERE referral_source = v_partner.referral_code AND is_active = true
    GROUP BY jt ORDER BY cnt DESC LIMIT 10
  ) sub;

  SELECT jsonb_agg(row_to_json(m)) INTO v_recent_candidates
  FROM (
    SELECT
      split_part(name, ' ', 1)
        || CASE WHEN position(' ' IN name) > 0
             THEN ' ' || left(split_part(name, ' ', 2), 1) || '.'
             ELSE ''
           END AS display_name,
      language, opted_in_at, job_types
    FROM candidates
    WHERE referral_source = v_partner.referral_code AND is_active = true
    ORDER BY opted_in_at DESC LIMIT 30
  ) m;

  RETURN jsonb_build_object(
    'partner_id',        v_partner.id,
    'partner_name',      v_partner.name,
    'referral_code',     v_partner.referral_code,
    'member_role',       v_member_role,
    'member_count',      v_member_count,
    'total_cvs',         v_total_cvs,
    'month_cvs',         v_month_cvs,
    'total_candidates',  v_candidates,
    'lang_breakdown',    COALESCE(v_lang_breakdown, '{}'::jsonb),
    'job_breakdown',     COALESCE(v_job_breakdown,  '{}'::jsonb),
    'recent_candidates', COALESCE(v_recent_candidates, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_partner_dashboard_data() TO authenticated;
