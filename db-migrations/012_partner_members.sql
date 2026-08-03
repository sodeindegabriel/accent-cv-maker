-- Migration 012: partner_members — team roles for partner organisations
-- Run in Supabase SQL editor AFTER migration 011.

-- ── Table ─────────────────────────────────────────────────────────────────────
-- email is the canonical identifier for a member slot (set at invite time).
-- user_id starts NULL and is filled in by claim_partner_account() on first login.
CREATE TABLE IF NOT EXISTS partner_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid        NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  email      text        NOT NULL,
  role       text        NOT NULL CHECK (role IN ('owner', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, email)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE partner_members ENABLE ROW LEVEL SECURITY;

-- Any claimed member can see the full member list for their partner
CREATE POLICY "members see own partner members"
  ON partner_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partner_members pm
      WHERE pm.partner_id = partner_members.partner_id
        AND pm.user_id    = auth.uid()
    )
  );

-- Admins see everything
CREATE POLICY "admins see all partner members"
  ON partner_members FOR SELECT TO authenticated
  USING (is_admin());

-- ── Grants ────────────────────────────────────────────────────────────────────
-- INSERT/UPDATE are handled exclusively through SECURITY DEFINER functions below.
GRANT SELECT ON partner_members TO authenticated;

-- ── claim_partner_account() — UPDATED ─────────────────────────────────────────
-- Now also handles:
--   • Already-claimed members (partner_members.user_id = auth.uid())
--   • First-login owner: inserts partner_members row with role='owner'
--   • First-login editor: sets partner_members.user_id where email matches
-- Returns the partner's referral_code on success, NULL for non-partners.
CREATE OR REPLACE FUNCTION claim_partner_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email    text;
  v_partner_id    uuid;
  v_referral_code text;
  v_member_id     uuid;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL THEN RETURN NULL; END IF;

  -- 1. Already-claimed member (owner or editor returning to dashboard)
  SELECT p.id, p.referral_code INTO v_partner_id, v_referral_code
  FROM partner_members pm
  JOIN partners p ON p.id = pm.partner_id
  WHERE pm.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_partner_id IS NOT NULL THEN RETURN v_referral_code; END IF;

  -- 2. First-login owner: unclaimed partners row matching this email
  SELECT id, referral_code INTO v_partner_id, v_referral_code
  FROM partners
  WHERE email = v_user_email AND is_active = true AND user_id IS NULL
  LIMIT 1;

  IF v_partner_id IS NOT NULL THEN
    -- Claim the partners row
    UPDATE partners SET user_id = auth.uid() WHERE id = v_partner_id;
    -- Elevate profile role
    UPDATE profiles SET role = 'partner' WHERE id = auth.uid();
    -- Insert owner membership record
    INSERT INTO partner_members (partner_id, user_id, email, role)
    VALUES (v_partner_id, auth.uid(), v_user_email, 'owner')
    ON CONFLICT (partner_id, email) DO UPDATE
      SET user_id = auth.uid();
    RETURN v_referral_code;
  END IF;

  -- 3. First-login editor: unclaimed partner_members row matching this email
  SELECT pm.id, p.id, p.referral_code INTO v_member_id, v_partner_id, v_referral_code
  FROM partner_members pm
  JOIN partners p ON p.id = pm.partner_id
  WHERE pm.email = v_user_email AND pm.user_id IS NULL AND p.is_active = true
  LIMIT 1;

  IF v_member_id IS NOT NULL THEN
    UPDATE partner_members SET user_id = auth.uid() WHERE id = v_member_id;
    UPDATE profiles SET role = 'partner' WHERE id = auth.uid();
    RETURN v_referral_code;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_partner_account() TO authenticated;

-- ── get_partner_dashboard_data() — UPDATED ────────────────────────────────────
-- Now resolves the partner via partner_members (owner OR editor both work).
-- Adds member_role and partner_id to the returned JSON so the dashboard can
-- gate the owner-only "Invite team member" UI.
CREATE OR REPLACE FUNCTION get_partner_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner       partners%ROWTYPE;
  v_member_role   text;
  v_total_cvs     int;
  v_month_cvs     int;
  v_candidates    int;
  v_lang_breakdown    jsonb;
  v_job_breakdown     jsonb;
  v_recent_candidates jsonb;
BEGIN
  -- Find partner via membership (covers both owner and editor)
  SELECT p.*, pm.role INTO v_partner.id, v_partner.user_id, v_partner.name,
    v_partner.email, v_partner.referral_code, v_partner.is_active,
    v_partner.created_at, v_member_role
  FROM partner_members pm
  JOIN partners p ON p.id = pm.partner_id
  WHERE pm.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

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

  -- Language breakdown from candidates
  SELECT jsonb_object_agg(lang, cnt) INTO v_lang_breakdown
  FROM (
    SELECT language AS lang, COUNT(*)::int AS cnt
    FROM candidates
    WHERE referral_source = v_partner.referral_code AND is_active = true
    GROUP BY language ORDER BY cnt DESC LIMIT 10
  ) sub;

  -- Job type breakdown from candidates
  SELECT jsonb_object_agg(jt, cnt) INTO v_job_breakdown
  FROM (
    SELECT jt, COUNT(*)::int AS cnt
    FROM candidates, unnest(job_types) AS jt
    WHERE referral_source = v_partner.referral_code AND is_active = true
    GROUP BY jt ORDER BY cnt DESC LIMIT 10
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

-- ── invite_partner_member() ───────────────────────────────────────────────────
-- Owner-only: adds an editor slot (pre-claimed by email, user_id filled on
-- first login via claim_partner_account()).
-- Raises an exception if the caller is not an owner, or the email already exists.
CREATE OR REPLACE FUNCTION invite_partner_member(p_partner_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role
  FROM partner_members
  WHERE partner_id = p_partner_id AND user_id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only owners can invite team members';
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
