-- Migration 023: Partner adviser read/edit access to client cover letters
-- Run in Supabase SQL editor AFTER migrations 018 (partner_edit_events) and 022 (cover_letters).

-- ── 1. Add cover_letter_id to partner_edit_events ─────────────────────────────
ALTER TABLE partner_edit_events
  ADD COLUMN IF NOT EXISTS cover_letter_id uuid REFERENCES cover_letters(id) ON DELETE SET NULL;

-- ── 2. get_partner_client_cover_letters(p_candidate_id uuid) ─────────────────
-- Returns the cover letters for one client (data-minimised: no advert_text,
-- answers or gaps). Scope-checks that the caller is an active partner member
-- and that the client is opted-in and belongs to that partner.
CREATE OR REPLACE FUNCTION get_partner_client_cover_letters(p_candidate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code  text;
  v_client_user_id uuid;
BEGIN
  -- Identify caller's active partner via partner_members
  SELECT p.referral_code INTO v_referral_code
  FROM partner_members pm
  JOIN partners p ON p.id = pm.partner_id
  WHERE pm.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_referral_code IS NULL THEN
    RAISE EXCEPTION 'not a partner member';
  END IF;

  -- Verify client belongs to this partner and has opted in
  -- is_active = true + user_id IS NOT NULL = opted in
  SELECT c.user_id INTO v_client_user_id
  FROM candidates c
  WHERE c.id             = p_candidate_id
    AND c.referral_source = v_referral_code
    AND c.is_active       = true
    AND c.user_id IS NOT NULL
  LIMIT 1;

  IF v_client_user_id IS NULL THEN
    RAISE EXCEPTION 'client not found or not opted in to this partner';
  END IF;

  -- Return data-minimised rows (no advert_text, answers, gaps)
  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id',          cl.id,
          'job_title',   cl.job_title,
          'company',     cl.company,
          'language',    cl.language,
          'english_text', cl.english_text,
          'native_text', cl.native_text,
          'created_at',  cl.created_at
        )
        ORDER BY cl.created_at DESC
      ),
      '[]'::jsonb
    )
    FROM cover_letters cl
    WHERE cl.user_id = v_client_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION get_partner_client_cover_letters(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_partner_client_cover_letters(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_partner_client_cover_letters(uuid) TO authenticated;

-- ── 3. partner_update_cover_letter(p_letter_id, p_english_text, p_native_text) ─
-- Scope-checks the letter owner is an opted-in client of the caller's partner.
-- Updates only english_text and native_text (never INSERT or DELETE).
-- Logs a partner_edit_events row.
-- Each text is capped at 10 000 characters.
CREATE OR REPLACE FUNCTION partner_update_cover_letter(
  p_letter_id    uuid,
  p_english_text text,
  p_native_text  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id     uuid;
  v_referral_code  text;
  v_letter_user_id uuid;
  v_candidate_id   uuid;
BEGIN
  -- Identify caller's active partner
  SELECT pm.partner_id, p.referral_code INTO v_partner_id, v_referral_code
  FROM partner_members pm
  JOIN partners p ON p.id = pm.partner_id
  WHERE pm.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'not a partner member';
  END IF;

  -- Resolve letter owner
  SELECT user_id INTO v_letter_user_id
  FROM cover_letters
  WHERE id = p_letter_id;

  IF v_letter_user_id IS NULL THEN
    RAISE EXCEPTION 'cover letter not found';
  END IF;

  -- Verify owner is an active opted-in candidate of this partner
  SELECT id INTO v_candidate_id
  FROM candidates
  WHERE user_id       = v_letter_user_id
    AND referral_source = v_referral_code
    AND is_active       = true
    AND user_id IS NOT NULL
  LIMIT 1;

  IF v_candidate_id IS NULL THEN
    RAISE EXCEPTION 'client not found or not opted in to this partner';
  END IF;

  -- Enforce 10 000-character limit on each text field
  IF length(p_english_text) > 10000 THEN
    RAISE EXCEPTION 'english_text exceeds 10 000 character limit';
  END IF;
  IF length(p_native_text) > 10000 THEN
    RAISE EXCEPTION 'native_text exceeds 10 000 character limit';
  END IF;

  -- Update only the two text fields — no INSERT, no DELETE
  UPDATE cover_letters
  SET english_text = p_english_text,
      native_text  = p_native_text,
      updated_at   = now()
  WHERE id = p_letter_id;

  -- Audit log
  INSERT INTO partner_edit_events (partner_id, editor_user_id, candidate_id, cover_letter_id)
  VALUES (v_partner_id, auth.uid(), v_candidate_id, p_letter_id);
END;
$$;

REVOKE ALL ON FUNCTION partner_update_cover_letter(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION partner_update_cover_letter(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION partner_update_cover_letter(uuid, text, text) TO authenticated;
