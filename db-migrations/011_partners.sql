-- Migration 011: partners — self-serve partner accounts & dashboard
-- Run in Supabase SQL editor.

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  email         text        NOT NULL UNIQUE,
  referral_code text        NOT NULL UNIQUE,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Partners read their own row (by user_id once claimed)
CREATE POLICY "partner sees own row"
  ON partners FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins see all rows
CREATE POLICY "admins see all partners"
  ON partners FOR SELECT TO authenticated
  USING (is_admin());

-- Only admins can insert new partner records
CREATE POLICY "admins can insert partners"
  ON partners FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- Admins can update any row; claim_partner_account() updates via SECURITY DEFINER
CREATE POLICY "admins can update partners"
  ON partners FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON partners TO authenticated;

-- ── claim_partner_account() ───────────────────────────────────────────────────
-- Called from the build auth flow after OTP verify / password sign-in.
-- For first login: matches auth.email() against partners.email WHERE user_id IS NULL,
--   then sets partners.user_id and profiles.role = 'partner'.
-- For returning partners: just returns the referral_code.
-- Returns NULL for non-partner users.
CREATE OR REPLACE FUNCTION claim_partner_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email text;
  v_partner_id uuid;
  v_referral_code text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL THEN RETURN NULL; END IF;

  -- First check: already-claimed partner row belonging to this user
  SELECT id, referral_code INTO v_partner_id, v_referral_code
  FROM partners
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_partner_id IS NOT NULL THEN RETURN v_referral_code; END IF;

  -- Second check: unclaimed partner row matching this email
  SELECT id, referral_code INTO v_partner_id, v_referral_code
  FROM partners
  WHERE email = v_user_email AND is_active = true AND user_id IS NULL
  LIMIT 1;

  IF v_partner_id IS NULL THEN RETURN NULL; END IF;

  -- Claim: link the partner row and elevate the profile role
  UPDATE partners SET user_id = auth.uid() WHERE id = v_partner_id;
  UPDATE profiles SET role = 'partner' WHERE id = auth.uid();

  RETURN v_referral_code;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_partner_account() TO authenticated;

-- ── get_partner_dashboard_data() ──────────────────────────────────────────────
-- Returns all data needed by the partner dashboard in a single RPC call.
-- Candidate names are masked to first-name + last-initial for privacy.
-- Returns NULL if the calling user has no active partner row.
CREATE OR REPLACE FUNCTION get_partner_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner     partners%ROWTYPE;
  v_total_cvs   int;
  v_month_cvs   int;
  v_candidates  int;
  v_lang_breakdown jsonb;
  v_job_breakdown  jsonb;
  v_recent_candidates jsonb;
BEGIN
  SELECT * INTO v_partner FROM partners WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
  IF v_partner.id IS NULL THEN RETURN NULL; END IF;

  -- Total CVs from referred users
  SELECT COUNT(*)::int INTO v_total_cvs
  FROM cv_documents cd
  JOIN partner_referrals pr ON pr.user_id = cd.user_id
  WHERE pr.referral_code = v_partner.referral_code;

  -- CVs this calendar month
  SELECT COUNT(*)::int INTO v_month_cvs
  FROM cv_documents cd
  JOIN partner_referrals pr ON pr.user_id = cd.user_id
  WHERE pr.referral_code = v_partner.referral_code
    AND cd.created_at >= date_trunc('month', now());

  -- Candidates in the pool from this partner's link
  SELECT COUNT(*)::int INTO v_candidates
  FROM candidates
  WHERE referral_source = v_partner.referral_code AND is_active = true;

  -- Language breakdown from candidates (primary language on their CV application)
  SELECT jsonb_object_agg(lang, cnt) INTO v_lang_breakdown
  FROM (
    SELECT language AS lang, COUNT(*)::int AS cnt
    FROM candidates
    WHERE referral_source = v_partner.referral_code AND is_active = true
    GROUP BY language
    ORDER BY cnt DESC
    LIMIT 10
  ) sub;

  -- Job type breakdown from candidates (explode the array, aggregate)
  SELECT jsonb_object_agg(jt, cnt) INTO v_job_breakdown
  FROM (
    SELECT jt, COUNT(*)::int AS cnt
    FROM candidates, unnest(job_types) AS jt
    WHERE referral_source = v_partner.referral_code AND is_active = true
    GROUP BY jt
    ORDER BY cnt DESC
    LIMIT 10
  ) sub;

  -- Recent candidates — masked: first name + last initial only
  SELECT jsonb_agg(row_to_json(m)) INTO v_recent_candidates
  FROM (
    SELECT
      split_part(name, ' ', 1)
        || CASE WHEN position(' ' IN name) > 0
             THEN ' ' || left(split_part(name, ' ', 2), 1) || '.'
             ELSE ''
           END AS display_name,
      language,
      opted_in_at,
      job_types
    FROM candidates
    WHERE referral_source = v_partner.referral_code AND is_active = true
    ORDER BY opted_in_at DESC
    LIMIT 30
  ) m;

  RETURN jsonb_build_object(
    'partner_name',   v_partner.name,
    'referral_code',  v_partner.referral_code,
    'total_cvs',      v_total_cvs,
    'month_cvs',      v_month_cvs,
    'total_candidates', v_candidates,
    'lang_breakdown', COALESCE(v_lang_breakdown, '{}'::jsonb),
    'job_breakdown',  COALESCE(v_job_breakdown,  '{}'::jsonb),
    'recent_candidates', COALESCE(v_recent_candidates, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_partner_dashboard_data() TO authenticated;
