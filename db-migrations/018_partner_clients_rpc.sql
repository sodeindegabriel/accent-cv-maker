-- Migration 018: Partner client list RPC + partner_edit_events table
-- + active_this_month in get_partner_dashboard_data()

-- ── 1. partner_edit_events table ─────────────────────────────────────────────
-- Tracks edits made by partner staff so they do NOT consume the candidate's
-- own edit quota. Separate from edit_events (which tracks candidate self-edits).
CREATE TABLE IF NOT EXISTS partner_edit_events (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id       uuid        REFERENCES partners(id) ON DELETE CASCADE,
  editor_user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  candidate_id     uuid        REFERENCES candidates(id) ON DELETE CASCADE,
  cv_document_id   uuid        REFERENCES cv_documents(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE partner_edit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_edit_events'
      AND policyname = 'Partner members can insert edit events'
  ) THEN
    CREATE POLICY "Partner members can insert edit events"
      ON partner_edit_events FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM partner_members
          WHERE user_id = auth.uid()
            AND partner_id = partner_edit_events.partner_id
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_edit_events'
      AND policyname = 'Partner members can view edit events'
  ) THEN
    CREATE POLICY "Partner members can view edit events"
      ON partner_edit_events FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM partner_members
          WHERE user_id = auth.uid()
            AND partner_id = partner_edit_events.partner_id
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT ON partner_edit_events TO authenticated;

-- ── 2. get_partner_clients() ──────────────────────────────────────────────────
-- Returns candidate rows scoped strictly to the calling partner's referral code.
-- Includes cv_english_html so partner can download CV as PDF/Word client-side.
CREATE OR REPLACE FUNCTION get_partner_clients()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code text;
BEGIN
  SELECT p.referral_code INTO v_referral_code
  FROM partner_members pm
  JOIN partners p ON p.id = pm.partner_id
  WHERE pm.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_referral_code IS NULL THEN
    RAISE EXCEPTION 'not a partner member';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.opted_in_at DESC), '[]'::jsonb)
    FROM (
      SELECT
        id                AS candidate_id,
        split_part(name, ' ', 1)
          || CASE WHEN position(' ' IN name) > 0
               THEN ' ' || left(split_part(name, ' ', 2), 1) || '.'
               ELSE ''
             END           AS display_name,
        language,
        job_types,
        opted_in_at,
        (cv_english IS NOT NULL) AS has_cv,
        (cv_english->>'html')    AS cv_english_html
      FROM candidates
      WHERE referral_source = v_referral_code AND is_active = true
    ) c
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_partner_clients() TO authenticated;

-- ── 3. get_partner_dashboard_data() — UPDATED ────────────────────────────────
-- Adds active_this_month: candidates referred by this partner who have a
-- cv_document created in the current calendar month.
CREATE OR REPLACE FUNCTION get_partner_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner           partners%ROWTYPE;
  v_member_role       text;
  v_member_count      int;
  v_total_cvs         int;
  v_month_cvs         int;
  v_active_this_month int;
  v_candidates        int;
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

  -- Active this month: candidates referred by this partner with at least one
  -- cv_document created in the current calendar month
  SELECT COUNT(DISTINCT c.user_id)::int INTO v_active_this_month
  FROM candidates c
  JOIN cv_documents cd ON cd.user_id = c.user_id
  WHERE c.referral_source = v_partner.referral_code
    AND c.is_active = true
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
    'partner_id',          v_partner.id,
    'partner_name',        v_partner.name,
    'referral_code',       v_partner.referral_code,
    'member_role',         v_member_role,
    'member_count',        v_member_count,
    'total_cvs',           v_total_cvs,
    'month_cvs',           v_month_cvs,
    'active_this_month',   v_active_this_month,
    'total_candidates',    v_candidates,
    'lang_breakdown',      COALESCE(v_lang_breakdown, '{}'::jsonb),
    'job_breakdown',       COALESCE(v_job_breakdown,  '{}'::jsonb),
    'recent_candidates',   COALESCE(v_recent_candidates, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_partner_dashboard_data() TO authenticated;
