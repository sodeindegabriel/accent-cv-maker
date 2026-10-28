-- Migration: Partner teams (managers and mentors), client assignments, case status,
-- notifications and activity log. CORRECTED version.
-- Run AFTER the partner sharing-consent migration (033 FIXED), which is already live.
-- Fixes vs the first draft: role constraint order (existing 'editor' rows made it
-- fail), outsiders could invite into any team, paging totals were wrong,
-- job types and letter counts were missing from the list, names now come from
-- profiles, last-manager guard serialised, removed members lose partner status,
-- pending invites can be cancelled, domains are normalised and validated.
--
-- EXISTING OBJECTS CHANGED:
--   partner_members             : adds notifications_seen_at; widens role
--                                 constraint to include 'manager','mentor';
--                                 migrates 'editor' rows to 'mentor'.
--   partners                    : adds allowed_email_domains text[].
--   invite_partner_member       : manager-level caller; cap 1000; role
--                                 'mentor'; domain check; activity log.
--   claim_partner_account       : domain check on path 3; activity log;
--                                 return NULL (not exception) on domain fail.
--   get_partner_dashboard_data  : removes recent_candidates; mentors get a
--                                 limited payload with own assignment counts.
--   get_partner_referred_clients: mentors see only their assigned clients.
--   get_partner_referred_cv     : manager or assigned mentor only.
--   get_partner_referred_cover_letters : same.
--   partner_update_referred_cover_letter : same.

-- ===========================================================================
-- SECTION 1: partner_members schema
-- ===========================================================================

ALTER TABLE partner_members
  ADD COLUMN IF NOT EXISTS notifications_seen_at timestamptz;

-- Drop whatever check constraint currently restricts role (its name may vary).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.partner_members'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.partner_members DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Migrate existing rows BEFORE adding the new constraint.
UPDATE partner_members SET role = 'mentor' WHERE role = 'editor';

ALTER TABLE partner_members
  ADD CONSTRAINT partner_members_role_check
  CHECK (role IN ('owner', 'manager', 'mentor'));

-- ===========================================================================
-- SECTION 1b: partners table additions
-- ===========================================================================

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS allowed_email_domains text[];

-- ===========================================================================
-- SECTION 2: New tables
-- ===========================================================================

CREATE TABLE IF NOT EXISTS partner_client_assignments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     uuid        NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  client_user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  status         text        NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'closed')),
  outcome        text
                 CHECK (outcome IN (
                   'employment', 'training', 'volunteering',
                   'no_longer_needs_support', 'moved_or_no_contact', 'other'
                 )),
  closed_note    text        CHECK (length(closed_note) <= 500),
  closed_at      timestamptz,
  closed_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (partner_id, client_user_id)
);

CREATE INDEX IF NOT EXISTS partner_client_assignments_mentor_idx
  ON partner_client_assignments (partner_id, mentor_user_id);

ALTER TABLE partner_client_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partner_client_assignments FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS partner_notifications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     uuid        NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  kind           text        NOT NULL,
  actor_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  client_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  message        text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_notifications_partner_created_idx
  ON partner_notifications (partner_id, created_at DESC);

ALTER TABLE partner_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partner_notifications FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS partner_activity_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     uuid        NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  actor_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action         text        NOT NULL,
  target_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  details        jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partner_activity_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partner_activity_log FROM PUBLIC, anon, authenticated;

-- ===========================================================================
-- SECTION 3: Backfill assignments for existing referred clients
-- ===========================================================================

INSERT INTO partner_client_assignments (partner_id, client_user_id, assigned_at)
SELECT DISTINCT p.id, pr.user_id, pr.created_at
FROM   partner_referrals pr
JOIN   partners p ON p.referral_code = pr.referral_code AND p.is_active = true
WHERE  pr.user_id IS NOT NULL
ON CONFLICT (partner_id, client_user_id) DO NOTHING;

-- ===========================================================================
-- SECTION 4: Internal helper (REVOKED from all non-postgres roles)
-- ===========================================================================

CREATE OR REPLACE FUNCTION partner_context(
  OUT partner_id    uuid,
  OUT referral_code text,
  OUT role          text,
  OUT is_manager    boolean
)
RETURNS RECORD
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT p.id, p.referral_code, pm.role,
         pm.role IN ('owner', 'manager')
  INTO   partner_id, referral_code, role, is_manager
  FROM   partner_members pm
  JOIN   partners p ON p.id = pm.partner_id
  WHERE  pm.user_id = auth.uid()
    AND  pm.user_id IS NOT NULL
    AND  p.is_active = true
  LIMIT  1;

  IF partner_id IS NULL THEN
    RAISE EXCEPTION 'not a partner member';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION partner_context() FROM PUBLIC, anon, authenticated;

-- ===========================================================================
-- SECTION 5: New functions
-- ===========================================================================

-- A. get_my_partner_role()
CREATE OR REPLACE FUNCTION get_my_partner_role()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx          RECORD;
  v_partner_name text;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();
  SELECT name INTO v_partner_name FROM partners WHERE id = v_ctx.partner_id;
  RETURN jsonb_build_object(
    'partner_id',    v_ctx.partner_id,
    'partner_name',  v_partner_name,
    'referral_code', v_ctx.referral_code,
    'role',          v_ctx.role,
    'is_manager',    v_ctx.is_manager
  );
END;
$$;

REVOKE ALL ON FUNCTION get_my_partner_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_partner_role() TO authenticated;

-- B. list_partner_team(p_limit, p_offset, p_search) - managers only
CREATE OR REPLACE FUNCTION list_partner_team(
  p_limit  int,
  p_offset int,
  p_search text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx            RECORD;
  v_search_escaped text;
  v_total          int;
  v_rows           jsonb;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();
  IF NOT v_ctx.is_manager THEN RAISE EXCEPTION 'manager access required'; END IF;

  v_search_escaped := replace(replace(replace(COALESCE(p_search, ''), '\', '\\'), '%', '\%'), '_', '\_');

  SELECT COUNT(*)::int INTO v_total
  FROM   partner_members pm
  LEFT   JOIN profiles prof ON prof.id = pm.user_id
  WHERE  pm.partner_id = v_ctx.partner_id
    AND (v_search_escaped = ''
         OR pm.email ILIKE '%' || v_search_escaped || '%' ESCAPE '\'
         OR COALESCE(prof.full_name, '') ILIKE '%' || v_search_escaped || '%' ESCAPE '\');

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at ASC, r.member_id), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      pm.id      AS member_id,
      pm.user_id AS member_user_id,
      COALESCE(NULLIF(btrim(prof.full_name), ''), split_part(pm.email, '@', 1)) AS name,
      pm.email,
      pm.role,
      pm.created_at,
      CASE WHEN pm.user_id IS NULL THEN 'invited' ELSE 'active' END AS status,
      (SELECT COUNT(*)::int FROM partner_client_assignments pca
       WHERE pca.partner_id = v_ctx.partner_id AND pca.mentor_user_id = pm.user_id
         AND pca.status = 'active') AS assigned_count,
      (SELECT COUNT(*)::int FROM partner_client_assignments pca
       WHERE pca.partner_id = v_ctx.partner_id AND pca.mentor_user_id = pm.user_id
         AND pca.status = 'closed') AS closed_count
    FROM   partner_members pm
    LEFT   JOIN profiles prof ON prof.id = pm.user_id
    WHERE  pm.partner_id = v_ctx.partner_id
      AND (v_search_escaped = ''
           OR pm.email ILIKE '%' || v_search_escaped || '%' ESCAPE '\'
           OR COALESCE(prof.full_name, '') ILIKE '%' || v_search_escaped || '%' ESCAPE '\')
    ORDER  BY pm.created_at ASC, pm.id
    LIMIT  LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) r;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION list_partner_team(int, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_partner_team(int, int, text) TO authenticated;

-- C. invite_partner_members(p_emails, p_role) - bulk invite, managers only
-- Supersedes invite_partner_member (singular).
CREATE OR REPLACE FUNCTION invite_partner_members(
  p_emails text[],
  p_role   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx               RECORD;
  v_partner_email     text;
  v_allowed_domains   text[];
  v_email             text;
  v_email_domain      text;
  v_seen              text[];
  v_added             int := 0;
  v_skipped           int := 0;
  v_invalid           int := 0;
  v_wrong_domain      int := 0;
  v_skipped_list      text[] := '{}';
  v_invalid_list      text[] := '{}';
  v_wrong_domain_list text[] := '{}';
  v_member_count      int;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();
  IF NOT v_ctx.is_manager THEN RAISE EXCEPTION 'manager access required'; END IF;
  IF p_role NOT IN ('mentor', 'manager') THEN RAISE EXCEPTION 'role must be mentor or manager'; END IF;

  IF array_length(p_emails, 1) IS NULL OR array_length(p_emails, 1) = 0 THEN
    RETURN jsonb_build_object('added', 0, 'skipped', 0, 'invalid', 0, 'wrong_domain', 0,
      'skipped_list', '[]'::jsonb, 'invalid_list', '[]'::jsonb, 'wrong_domain_list', '[]'::jsonb);
  END IF;

  IF array_length(p_emails, 1) > 100 THEN RAISE EXCEPTION 'at most 100 emails per call'; END IF;

  SELECT COUNT(*)::int INTO v_member_count FROM partner_members WHERE partner_id = v_ctx.partner_id;
  IF v_member_count >= 1000 THEN RAISE EXCEPTION 'partner member limit reached (1000 members maximum)'; END IF;

  SELECT p.email, p.allowed_email_domains INTO v_partner_email, v_allowed_domains
  FROM   partners p WHERE p.id = v_ctx.partner_id;

  FOREACH v_email IN ARRAY p_emails LOOP
    v_email := lower(trim(COALESCE(v_email, '')));

    IF v_email = '' THEN
      v_invalid := v_invalid + 1;
      CONTINUE;
    END IF;

    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      v_invalid      := v_invalid + 1;
      v_invalid_list := array_append(v_invalid_list, v_email);
      CONTINUE;
    END IF;

    IF v_email = ANY(COALESCE(v_seen, '{}')) THEN CONTINUE; END IF;
    v_seen := array_append(v_seen, v_email);

    IF EXISTS (SELECT 1 FROM partner_members WHERE partner_id = v_ctx.partner_id AND email = v_email) THEN
      v_skipped      := v_skipped + 1;
      v_skipped_list := array_append(v_skipped_list, v_email);
      CONTINUE;
    END IF;

    IF v_allowed_domains IS NOT NULL AND array_length(v_allowed_domains, 1) > 0 THEN
      IF v_email != lower(COALESCE(v_partner_email, '')) THEN
        v_email_domain := split_part(v_email, '@', 2);
        IF NOT (v_email_domain = ANY(v_allowed_domains)) THEN
          v_wrong_domain      := v_wrong_domain + 1;
          v_wrong_domain_list := array_append(v_wrong_domain_list, v_email);
          CONTINUE;
        END IF;
      END IF;
    END IF;

    INSERT INTO partner_members (partner_id, email, role) VALUES (v_ctx.partner_id, v_email, p_role);
    INSERT INTO partner_activity_log (partner_id, actor_user_id, action, details)
    VALUES (v_ctx.partner_id, auth.uid(), 'member_invited',
            jsonb_build_object('email', v_email, 'role', p_role));
    v_added := v_added + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'added', v_added, 'skipped', v_skipped, 'invalid', v_invalid, 'wrong_domain', v_wrong_domain,
    'skipped_list', to_jsonb(v_skipped_list), 'invalid_list', to_jsonb(v_invalid_list),
    'wrong_domain_list', to_jsonb(v_wrong_domain_list)
  );
END;
$$;

REVOKE ALL ON FUNCTION invite_partner_members(text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION invite_partner_members(text[], text) TO authenticated;

-- D. set_partner_member_role(p_member_user_id, p_role) - managers only
CREATE OR REPLACE FUNCTION set_partner_member_role(p_member_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx           RECORD;
  v_old_role      text;
  v_manager_count int;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();
  IF NOT v_ctx.is_manager THEN RAISE EXCEPTION 'manager access required'; END IF;
  IF p_role NOT IN ('mentor', 'manager') THEN RAISE EXCEPTION 'role must be mentor or manager'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('partner_team:' || v_ctx.partner_id::text));

  SELECT role INTO v_old_role FROM partner_members
  WHERE  partner_id = v_ctx.partner_id AND user_id = p_member_user_id;
  IF v_old_role IS NULL THEN RAISE EXCEPTION 'member not found in this partner'; END IF;

  IF p_role = 'mentor' AND v_old_role IN ('owner', 'manager') THEN
    SELECT COUNT(*)::int INTO v_manager_count FROM partner_members
    WHERE  partner_id = v_ctx.partner_id AND role IN ('owner', 'manager') AND user_id IS NOT NULL;
    IF v_manager_count <= 1 THEN RAISE EXCEPTION 'last_manager'; END IF;
  END IF;

  UPDATE partner_members SET role = p_role
  WHERE  partner_id = v_ctx.partner_id AND user_id = p_member_user_id;

  INSERT INTO partner_activity_log (partner_id, actor_user_id, action, target_user_id, details)
  VALUES (v_ctx.partner_id, auth.uid(), 'member_role_changed', p_member_user_id,
          jsonb_build_object('old_role', v_old_role, 'new_role', p_role));
END;
$$;

REVOKE ALL ON FUNCTION set_partner_member_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_partner_member_role(uuid, text) TO authenticated;

-- E. remove_partner_member(p_member_user_id, p_reassign_to) - managers only
CREATE OR REPLACE FUNCTION remove_partner_member(p_member_user_id uuid, p_reassign_to uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx           RECORD;
  v_old_role      text;
  v_manager_count int;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();
  IF NOT v_ctx.is_manager THEN RAISE EXCEPTION 'manager access required'; END IF;
  IF p_member_user_id = auth.uid() THEN RAISE EXCEPTION 'cannot remove yourself'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('partner_team:' || v_ctx.partner_id::text));

  SELECT role INTO v_old_role FROM partner_members
  WHERE  partner_id = v_ctx.partner_id AND user_id = p_member_user_id;
  IF v_old_role IS NULL THEN RAISE EXCEPTION 'member not found in this partner'; END IF;

  IF v_old_role IN ('owner', 'manager') THEN
    SELECT COUNT(*)::int INTO v_manager_count FROM partner_members
    WHERE  partner_id = v_ctx.partner_id AND role IN ('owner', 'manager') AND user_id IS NOT NULL;
    IF v_manager_count <= 1 THEN RAISE EXCEPTION 'last_manager'; END IF;
  END IF;

  IF p_reassign_to IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM partner_members
                   WHERE partner_id = v_ctx.partner_id AND user_id = p_reassign_to AND user_id IS NOT NULL)
    THEN RAISE EXCEPTION 'reassignment target is not an active member of this partner'; END IF;
    UPDATE partner_client_assignments
    SET    mentor_user_id = p_reassign_to, assigned_by = auth.uid(), assigned_at = now()
    WHERE  partner_id = v_ctx.partner_id AND mentor_user_id = p_member_user_id;
  ELSE
    UPDATE partner_client_assignments SET mentor_user_id = NULL
    WHERE  partner_id = v_ctx.partner_id AND mentor_user_id = p_member_user_id;
  END IF;

  DELETE FROM partner_members WHERE partner_id = v_ctx.partner_id AND user_id = p_member_user_id;

  -- A person who is no longer on any partner team is no longer partner staff.
  UPDATE profiles SET role = 'user'
  WHERE  id = p_member_user_id AND role = 'partner'
    AND  NOT EXISTS (SELECT 1 FROM partner_members WHERE user_id = p_member_user_id);

  INSERT INTO partner_activity_log (partner_id, actor_user_id, action, target_user_id, details)
  VALUES (v_ctx.partner_id, auth.uid(), 'member_removed', p_member_user_id,
          jsonb_build_object('old_role', v_old_role, 'reassigned_to', p_reassign_to));
END;
$$;

REVOKE ALL ON FUNCTION remove_partner_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION remove_partner_member(uuid, uuid) TO authenticated;

-- E2. cancel_partner_invite(p_member_id) - managers only: withdraw a pending invite
CREATE OR REPLACE FUNCTION cancel_partner_invite(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx   RECORD;
  v_email text;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();
  IF NOT v_ctx.is_manager THEN RAISE EXCEPTION 'manager access required'; END IF;

  DELETE FROM partner_members
  WHERE  id = p_member_id AND partner_id = v_ctx.partner_id AND user_id IS NULL
  RETURNING email INTO v_email;

  IF v_email IS NULL THEN RAISE EXCEPTION 'pending invite not found'; END IF;

  INSERT INTO partner_activity_log (partner_id, actor_user_id, action, details)
  VALUES (v_ctx.partner_id, auth.uid(), 'invite_cancelled', jsonb_build_object('email', v_email));
END;
$$;

REVOKE ALL ON FUNCTION cancel_partner_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_partner_invite(uuid) TO authenticated;

-- F. assign_partner_clients(p_client_refs, p_mentor_user_id) - managers only
CREATE OR REPLACE FUNCTION assign_partner_clients(p_client_refs uuid[], p_mentor_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx            RECORD;
  v_client_ref     uuid;
  v_client_user_id uuid;
  v_changed        int := 0;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();
  IF NOT v_ctx.is_manager THEN RAISE EXCEPTION 'manager access required'; END IF;
  IF array_length(p_client_refs, 1) > 200 THEN RAISE EXCEPTION 'at most 200 client_refs per call'; END IF;

  IF p_mentor_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM partner_members
                   WHERE partner_id = v_ctx.partner_id AND user_id = p_mentor_user_id AND user_id IS NOT NULL)
    THEN RAISE EXCEPTION 'mentor_user_id is not an active member of this partner'; END IF;
  END IF;

  FOREACH v_client_ref IN ARRAY COALESCE(p_client_refs, '{}') LOOP
    SELECT pr.user_id INTO v_client_user_id FROM partner_referrals pr
    WHERE  pr.id = v_client_ref AND pr.referral_code = v_ctx.referral_code AND pr.user_id IS NOT NULL;
    IF v_client_user_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO partner_client_assignments
      (partner_id, client_user_id, mentor_user_id, assigned_by, assigned_at, status)
    VALUES (v_ctx.partner_id, v_client_user_id, p_mentor_user_id, auth.uid(), now(), 'active')
    ON CONFLICT (partner_id, client_user_id) DO UPDATE SET
      mentor_user_id = EXCLUDED.mentor_user_id, assigned_by = EXCLUDED.assigned_by,
      assigned_at = EXCLUDED.assigned_at, status = 'active',
      closed_at = NULL, closed_by = NULL, outcome = NULL, closed_note = NULL;

    INSERT INTO partner_activity_log (partner_id, actor_user_id, action, target_user_id, details)
    VALUES (v_ctx.partner_id, auth.uid(), 'client_assigned', v_client_user_id,
            jsonb_build_object('client_ref', v_client_ref, 'mentor_user_id', p_mentor_user_id));

    v_changed := v_changed + 1;
  END LOOP;

  RETURN v_changed;
END;
$$;

REVOKE ALL ON FUNCTION assign_partner_clients(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION assign_partner_clients(uuid[], uuid) TO authenticated;

-- G. reassign_mentor_clients(p_from, p_to) - managers only
CREATE OR REPLACE FUNCTION reassign_mentor_clients(p_from_user_id uuid, p_to_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx  RECORD;
  v_moved int;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();
  IF NOT v_ctx.is_manager THEN RAISE EXCEPTION 'manager access required'; END IF;

  IF NOT EXISTS (SELECT 1 FROM partner_members WHERE partner_id = v_ctx.partner_id AND user_id = p_from_user_id AND user_id IS NOT NULL)
  THEN RAISE EXCEPTION 'source mentor is not an active member of this partner'; END IF;

  IF NOT EXISTS (SELECT 1 FROM partner_members WHERE partner_id = v_ctx.partner_id AND user_id = p_to_user_id AND user_id IS NOT NULL)
  THEN RAISE EXCEPTION 'target mentor is not an active member of this partner'; END IF;

  UPDATE partner_client_assignments
  SET    mentor_user_id = p_to_user_id, assigned_by = auth.uid(), assigned_at = now()
  WHERE  partner_id = v_ctx.partner_id AND mentor_user_id = p_from_user_id AND status = 'active';

  GET DIAGNOSTICS v_moved = ROW_COUNT;

  INSERT INTO partner_activity_log (partner_id, actor_user_id, action, target_user_id, details)
  VALUES (v_ctx.partner_id, auth.uid(), 'mentor_clients_reassigned', p_to_user_id,
          jsonb_build_object('from_user_id', p_from_user_id, 'to_user_id', p_to_user_id, 'count', v_moved));

  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION reassign_mentor_clients(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reassign_mentor_clients(uuid, uuid) TO authenticated;

-- H. set_client_case_status - managers any client, mentors only their assigned client
CREATE OR REPLACE FUNCTION set_client_case_status(
  p_client_ref uuid, p_status text, p_outcome text, p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx            RECORD;
  v_client_user_id uuid;
  v_assignment     RECORD;
  v_actor_name     text;
  v_client_name    text;
  v_outcome_label  text;
  v_message        text;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();

  IF p_status IS NULL OR p_status NOT IN ('active', 'closed') THEN RAISE EXCEPTION 'p_status must be active or closed'; END IF;
  IF p_outcome IS NOT NULL AND p_outcome NOT IN (
    'employment','training','volunteering','no_longer_needs_support','moved_or_no_contact','other'
  ) THEN RAISE EXCEPTION 'invalid outcome value'; END IF;
  IF p_note IS NOT NULL AND length(p_note) > 500 THEN RAISE EXCEPTION 'note exceeds 500 character limit'; END IF;

  SELECT pr.user_id INTO v_client_user_id FROM partner_referrals pr
  WHERE  pr.id = p_client_ref AND pr.referral_code = v_ctx.referral_code AND pr.user_id IS NOT NULL;
  IF v_client_user_id IS NULL THEN RAISE EXCEPTION 'client not found in this partner'; END IF;

  SELECT * INTO v_assignment FROM partner_client_assignments
  WHERE  partner_id = v_ctx.partner_id AND client_user_id = v_client_user_id;

  IF NOT FOUND THEN
    -- no assignment row yet: only a manager may act on an unassigned client
    IF NOT v_ctx.is_manager THEN RAISE EXCEPTION 'mentors may only update clients assigned to them'; END IF;
    INSERT INTO partner_client_assignments (partner_id, client_user_id, assigned_by)
    VALUES (v_ctx.partner_id, v_client_user_id, auth.uid());
  ELSIF NOT v_ctx.is_manager AND v_assignment.mentor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'mentors may only update clients assigned to them';
  END IF;

  IF p_status = 'closed' THEN
    UPDATE partner_client_assignments
    SET    status = 'closed', outcome = p_outcome, closed_note = p_note, closed_at = now(), closed_by = auth.uid()
    WHERE  partner_id = v_ctx.partner_id AND client_user_id = v_client_user_id;
  ELSE
    UPDATE partner_client_assignments
    SET    status = 'active', outcome = NULL, closed_note = NULL, closed_at = NULL, closed_by = NULL
    WHERE  partner_id = v_ctx.partner_id AND client_user_id = v_client_user_id;
  END IF;

  SELECT COALESCE(NULLIF(btrim(prof.full_name), ''), split_part(u.email, '@', 1))
  INTO   v_actor_name
  FROM   auth.users u LEFT JOIN profiles prof ON prof.id = u.id
  WHERE  u.id = auth.uid();
  v_actor_name := COALESCE(v_actor_name, 'A team member');

  SELECT CASE
    WHEN prof.full_name IS NULL OR btrim(prof.full_name) = '' THEN 'a client'
    WHEN position(' ' IN btrim(prof.full_name)) > 0
      THEN split_part(btrim(prof.full_name), ' ', 1) || ' ' || left(split_part(btrim(prof.full_name), ' ', 2), 1) || '.'
    ELSE btrim(prof.full_name)
  END INTO v_client_name FROM profiles prof WHERE prof.id = v_client_user_id;
  v_client_name := COALESCE(v_client_name, 'a client');

  v_outcome_label := CASE p_outcome
    WHEN 'employment' THEN 'Employment' WHEN 'training' THEN 'Training'
    WHEN 'volunteering' THEN 'Volunteering' WHEN 'no_longer_needs_support' THEN 'No longer needs support'
    WHEN 'moved_or_no_contact' THEN 'Moved or no contact' WHEN 'other' THEN 'Other' ELSE NULL
  END;

  IF p_status = 'closed' THEN
    v_message := v_actor_name || ' closed the case for ' || v_client_name
      || CASE WHEN v_outcome_label IS NOT NULL THEN ' (' || v_outcome_label || ')' ELSE '' END;
  ELSE
    v_message := v_actor_name || ' reopened the case for ' || v_client_name;
  END IF;

  INSERT INTO partner_notifications (partner_id, kind, actor_user_id, client_user_id, message)
  VALUES (v_ctx.partner_id,
          CASE WHEN p_status = 'closed' THEN 'case_closed' ELSE 'case_reopened' END,
          auth.uid(), v_client_user_id, v_message);

  INSERT INTO partner_activity_log (partner_id, actor_user_id, action, target_user_id, details)
  VALUES (v_ctx.partner_id, auth.uid(),
          CASE WHEN p_status = 'closed' THEN 'case_closed' ELSE 'case_reopened' END,
          v_client_user_id,
          jsonb_build_object('client_ref', p_client_ref, 'status', p_status, 'outcome', p_outcome, 'note', p_note));
END;
$$;

REVOKE ALL ON FUNCTION set_client_case_status(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_client_case_status(uuid, text, text, text) TO authenticated;

-- I. get_partner_notifications() and mark_partner_notifications_seen()
CREATE OR REPLACE FUNCTION get_partner_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx          RECORD;
  v_seen_at      timestamptz;
  v_unread_count int;
  v_rows         jsonb;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();
  IF NOT v_ctx.is_manager THEN RAISE EXCEPTION 'manager access required'; END IF;

  SELECT notifications_seen_at INTO v_seen_at FROM partner_members
  WHERE  partner_id = v_ctx.partner_id AND user_id = auth.uid();

  SELECT COUNT(*)::int INTO v_unread_count FROM partner_notifications
  WHERE  partner_id = v_ctx.partner_id
    AND  created_at > COALESCE(v_seen_at, '-infinity'::timestamptz);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'actor_user_id', n.actor_user_id,
    'client_user_id', n.client_user_id, 'message', n.message, 'created_at', n.created_at
  ) ORDER BY n.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (SELECT * FROM partner_notifications WHERE partner_id=v_ctx.partner_id
        ORDER BY created_at DESC LIMIT 50) n;

  RETURN jsonb_build_object('rows', v_rows, 'unread_count', v_unread_count);
END;
$$;

REVOKE ALL ON FUNCTION get_partner_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_partner_notifications() TO authenticated;

CREATE OR REPLACE FUNCTION mark_partner_notifications_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ctx RECORD;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();
  IF NOT v_ctx.is_manager THEN RAISE EXCEPTION 'manager access required'; END IF;
  UPDATE partner_members SET notifications_seen_at = now()
  WHERE  partner_id = v_ctx.partner_id AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION mark_partner_notifications_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_partner_notifications_seen() TO authenticated;

-- J. get_partner_clients_page() - role-aware paginated list with filters
CREATE OR REPLACE FUNCTION get_partner_clients_page(
  p_limit int, p_offset int, p_filter text, p_mentor_user_id uuid, p_search text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx            RECORD;
  v_limit          int;
  v_offset         int;
  v_filter         text;
  v_search_escaped text;
  v_total          int;
  v_unassigned     int;
  v_rows           jsonb;
BEGIN
  SELECT * INTO v_ctx FROM partner_context();

  v_limit  := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_filter := COALESCE(p_filter, 'all');

  IF v_filter NOT IN ('all','unassigned','assigned','active','closed') THEN
    RAISE EXCEPTION 'p_filter must be all, unassigned, assigned, active, or closed';
  END IF;

  v_search_escaped := replace(replace(replace(COALESCE(p_search, ''), '\', '\\'), '%', '\%'), '_', '\_');

  WITH base AS (
    SELECT
      u.client_ref,
      u.user_id AS client_user_id,
      u.joined_at,
      CASE
        WHEN prof.full_name IS NULL OR btrim(prof.full_name) = '' THEN 'Referred user'
        WHEN position(' ' IN btrim(prof.full_name)) > 0
          THEN split_part(btrim(prof.full_name), ' ', 1) || ' ' || left(split_part(btrim(prof.full_name), ' ', 2), 1) || '.'
        ELSE btrim(prof.full_name)
      END AS display_name,
      prof.default_cv_language AS language,
      EXISTS (SELECT 1 FROM cv_documents cd WHERE cd.user_id = u.user_id) AS has_cv,
      (psc.id IS NOT NULL AND psc.withdrawn_at IS NULL) AS shared,
      CASE WHEN psc.id IS NOT NULL AND psc.withdrawn_at IS NULL THEN psc.scope ELSE NULL END AS scope,
      CASE WHEN psc.id IS NOT NULL AND psc.withdrawn_at IS NULL THEN (
        SELECT jsonb_agg(
                 CASE WHEN t.e = 'other' AND btrim(coalesce(latest.form_data->>'otherJobType', '')) <> ''
                      THEN btrim(latest.form_data->>'otherJobType') ELSE t.e END)
        FROM jsonb_array_elements_text(
               CASE WHEN jsonb_typeof(latest.form_data->'jobTypes') = 'array'
                    THEN latest.form_data->'jobTypes' ELSE '[]'::jsonb END) AS t(e)
      ) ELSE NULL END AS job_types,
      CASE WHEN psc.id IS NOT NULL AND psc.withdrawn_at IS NULL AND psc.scope = 'full'
           THEN (SELECT COUNT(*)::int FROM cover_letters cl WHERE cl.user_id = u.user_id)
           ELSE NULL END AS cover_letter_count,
      pca.mentor_user_id,
      CASE WHEN pca.mentor_user_id IS NULL THEN NULL
           ELSE COALESCE(NULLIF(btrim(mprof.full_name), ''), split_part(mu.email, '@', 1))
      END AS mentor_name,
      COALESCE(pca.status, 'active') AS case_status,
      pca.closed_at,
      pca.outcome
    FROM (
      SELECT DISTINCT ON (pr.user_id) pr.user_id, pr.id AS client_ref, pr.created_at AS joined_at
      FROM   partner_referrals pr
      WHERE  pr.referral_code = v_ctx.referral_code AND pr.user_id IS NOT NULL
      ORDER  BY pr.user_id, pr.created_at DESC
    ) u
    LEFT JOIN profiles prof ON prof.id = u.user_id
    LEFT JOIN partner_sharing_consents psc ON psc.user_id = u.user_id AND psc.partner_id = v_ctx.partner_id
    LEFT JOIN partner_client_assignments pca ON pca.partner_id = v_ctx.partner_id AND pca.client_user_id = u.user_id
    LEFT JOIN auth.users mu ON mu.id = pca.mentor_user_id
    LEFT JOIN profiles mprof ON mprof.id = pca.mentor_user_id
    LEFT JOIN LATERAL (
      SELECT cd.form_data FROM cv_documents cd
      WHERE cd.user_id = u.user_id ORDER BY cd.created_at DESC LIMIT 1
    ) latest ON true
    WHERE (v_ctx.is_manager OR pca.mentor_user_id = auth.uid())
      AND (NOT v_ctx.is_manager OR v_filter = 'all'
           OR (v_filter = 'unassigned' AND pca.mentor_user_id IS NULL)
           OR (v_filter = 'assigned'   AND pca.mentor_user_id IS NOT NULL)
           OR (v_filter = 'active'     AND COALESCE(pca.status, 'active') = 'active')
           OR (v_filter = 'closed'     AND pca.status = 'closed'))
      AND (NOT v_ctx.is_manager OR p_mentor_user_id IS NULL OR pca.mentor_user_id = p_mentor_user_id)
  ),
  filtered AS (
    SELECT * FROM base b
    WHERE v_search_escaped = '' OR b.display_name ILIKE '%' || v_search_escaped || '%' ESCAPE '\'
  ),
  tot AS (SELECT COUNT(*)::int AS n FROM filtered),
  pg AS (
    SELECT * FROM filtered ORDER BY joined_at DESC, client_ref LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT n FROM tot),
         COALESCE(jsonb_agg(jsonb_build_object(
           'client_ref', pg.client_ref, 'display_name', pg.display_name, 'language', pg.language,
           'joined_at', pg.joined_at, 'has_cv', pg.has_cv, 'shared', pg.shared, 'scope', pg.scope,
           'job_types', pg.job_types, 'cover_letter_count', pg.cover_letter_count,
           'mentor_user_id', pg.mentor_user_id, 'mentor_name', pg.mentor_name,
           'case_status', pg.case_status, 'closed_at', pg.closed_at, 'outcome', pg.outcome
         ) ORDER BY pg.joined_at DESC, pg.client_ref), '[]'::jsonb)
  INTO v_total, v_rows
  FROM pg;

  IF v_ctx.is_manager THEN
    SELECT COUNT(*)::int INTO v_unassigned FROM (
      SELECT DISTINCT ON (pr.user_id) pr.user_id
      FROM   partner_referrals pr
      LEFT   JOIN partner_client_assignments pca
               ON pca.partner_id = v_ctx.partner_id AND pca.client_user_id = pr.user_id
      WHERE  pr.referral_code = v_ctx.referral_code AND pr.user_id IS NOT NULL
        AND  (pca.id IS NULL OR pca.mentor_user_id IS NULL)
        AND  COALESCE(pca.status, 'active') = 'active'
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total', COALESCE(v_total, 0),
    'unassigned_count', CASE WHEN v_ctx.is_manager THEN v_unassigned ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION get_partner_clients_page(int, int, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_partner_clients_page(int, int, text, uuid, text) TO authenticated;

-- L. set_partner_allowed_domains(p_partner_id, p_domains) - admin only
CREATE OR REPLACE FUNCTION set_partner_allowed_domains(p_partner_id uuid, p_domains text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text[];
  d       text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin access required'; END IF;

  IF p_domains IS NULL OR array_length(p_domains, 1) IS NULL THEN
    v_clean := NULL;
  ELSE
    v_clean := '{}';
    FOREACH d IN ARRAY p_domains LOOP
      d := lower(btrim(regexp_replace(COALESCE(d, ''), '^@', '')));
      IF d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN
        RAISE EXCEPTION 'invalid domain: %', d;
      END IF;
      IF NOT (d = ANY(v_clean)) THEN v_clean := array_append(v_clean, d); END IF;
    END LOOP;
  END IF;

  UPDATE partners SET allowed_email_domains = v_clean WHERE id = p_partner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'partner not found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION set_partner_allowed_domains(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_partner_allowed_domains(uuid, text[]) TO authenticated;

-- ===========================================================================
-- SECTION 6: Updated existing functions (live bodies as base)
-- ===========================================================================

-- K1. invite_partner_member(p_partner_id, p_email)
-- Legacy single-email invite; superseded by invite_partner_members (bulk).
-- LIVE base: migration 012. Line-level changes listed at bottom.
CREATE OR REPLACE FUNCTION invite_partner_member(p_partner_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role     text;
  v_member_count    int;
  v_partner_email   text;
  v_allowed_domains text[];
  v_clean_email     text;
  v_email_domain    text;
BEGIN
  SELECT role INTO v_caller_role FROM partner_members
  WHERE  partner_id = p_partner_id AND user_id = auth.uid();

  -- CHANGED: 'owner' -> ('owner','manager')
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Only managers can invite team members';
  END IF;

  -- CHANGED: >= 2 -> >= 1000
  SELECT COUNT(*) INTO v_member_count FROM partner_members WHERE partner_id = p_partner_id;
  IF v_member_count >= 1000 THEN
    RAISE EXCEPTION 'Team member limit reached (1000 members maximum per partner)';
  END IF;

  -- ADDED: lowercase and format validation
  v_clean_email := lower(trim(p_email));
  IF v_clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid email format';
  END IF;

  IF EXISTS (SELECT 1 FROM partner_members WHERE partner_id=p_partner_id AND email=v_clean_email) THEN
    RAISE EXCEPTION 'This email is already a member of this partner';
  END IF;

  -- ADDED: domain check
  SELECT pt.email, pt.allowed_email_domains INTO v_partner_email, v_allowed_domains
  FROM   partners pt WHERE pt.id = p_partner_id;

  IF v_allowed_domains IS NOT NULL AND array_length(v_allowed_domains,1) > 0 THEN
    IF v_clean_email != lower(COALESCE(v_partner_email,'')) THEN
      v_email_domain := split_part(v_clean_email,'@',2);
      IF NOT (v_email_domain = ANY(v_allowed_domains)) THEN
        RAISE EXCEPTION 'wrong_domain';
      END IF;
    END IF;
  END IF;

  -- CHANGED: 'editor' -> 'mentor'
  INSERT INTO partner_members (partner_id, email, role) VALUES (p_partner_id, v_clean_email, 'mentor');

  -- ADDED: activity log
  INSERT INTO partner_activity_log (partner_id, actor_user_id, action, details)
  VALUES (p_partner_id, auth.uid(), 'member_invited', jsonb_build_object('email',v_clean_email,'role','mentor'));
END;
$$;

REVOKE ALL ON FUNCTION invite_partner_member(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION invite_partner_member(uuid, text) TO authenticated;

-- K2. get_partner_referred_clients(p_limit, p_offset)
-- LIVE base: migration 033. Mentors now see only their assigned clients.
CREATE OR REPLACE FUNCTION get_partner_referred_clients(p_limit int, p_offset int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_partner_id    uuid;
  v_referral_code text;
  v_is_manager    boolean;
  v_limit         int;
  v_offset        int;
  v_total         int;
  v_rows          jsonb;
BEGIN
  SELECT p.id, p.referral_code INTO v_partner_id, v_referral_code
  FROM partner_members pm JOIN partners p ON p.id=pm.partner_id
  WHERE pm.user_id=auth.uid() AND p.is_active=true LIMIT 1;

  IF v_partner_id IS NULL THEN RAISE EXCEPTION 'not a partner member'; END IF;

  -- ADDED
  SELECT pm.role IN ('owner','manager') INTO v_is_manager
  FROM   partner_members pm WHERE pm.user_id=auth.uid() AND pm.partner_id=v_partner_id;

  v_limit  := LEAST(GREATEST(COALESCE(p_limit,10),1),100);
  v_offset := GREATEST(COALESCE(p_offset,0),0);

  -- CHANGED: added LEFT JOIN pca and mentor filter in WHERE
  SELECT COUNT(DISTINCT pr.user_id)::int INTO v_total
  FROM partner_referrals pr
  LEFT JOIN partner_client_assignments pca ON pca.partner_id=v_partner_id AND pca.client_user_id=pr.user_id
  WHERE pr.referral_code=v_referral_code AND pr.user_id IS NOT NULL
    AND (v_is_manager OR pca.mentor_user_id=auth.uid());

  SELECT COALESCE(jsonb_agg(pg.row_data ORDER BY pg.joined_at DESC, pg.user_id),'[]'::jsonb) INTO v_rows
  FROM (
    SELECT u.user_id, u.joined_at,
      jsonb_build_object(
        'client_ref',   u.client_ref,
        'display_name', CASE
          WHEN prof.full_name IS NULL OR btrim(prof.full_name)='' THEN 'Referred user'
          WHEN position(' ' IN btrim(prof.full_name))>0
            THEN split_part(btrim(prof.full_name),' ',1)||' '||left(split_part(btrim(prof.full_name),' ',2),1)||'.'
          ELSE btrim(prof.full_name)
        END,
        'joined_at',    u.joined_at,
        'language',     prof.default_cv_language,
        'has_cv',       EXISTS (SELECT 1 FROM cv_documents cd WHERE cd.user_id=u.user_id),
        'shared',       (psc.id IS NOT NULL AND psc.withdrawn_at IS NULL),
        'scope',        CASE WHEN psc.id IS NOT NULL AND psc.withdrawn_at IS NULL THEN psc.scope ELSE NULL END,
        'job_types',    CASE WHEN psc.id IS NOT NULL AND psc.withdrawn_at IS NULL THEN (
          SELECT jsonb_agg(
            CASE WHEN t.e='other' AND btrim(coalesce(latest.form_data->>'otherJobType',''))<>''
              THEN btrim(latest.form_data->>'otherJobType') ELSE t.e END)
          FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(latest.form_data->'jobTypes')='array'
                 THEN latest.form_data->'jobTypes' ELSE '[]'::jsonb END) AS t(e)
        ) ELSE NULL END,
        'cover_letter_count', CASE WHEN psc.id IS NOT NULL AND psc.withdrawn_at IS NULL AND psc.scope='full'
          THEN (SELECT COUNT(*)::int FROM cover_letters cl WHERE cl.user_id=u.user_id) ELSE NULL END
      ) AS row_data
    FROM (
      -- CHANGED: added LEFT JOIN pca and mentor filter
      SELECT DISTINCT ON (pr.user_id) pr.user_id, pr.id AS client_ref, pr.created_at AS joined_at
      FROM partner_referrals pr
      LEFT JOIN partner_client_assignments pca ON pca.partner_id=v_partner_id AND pca.client_user_id=pr.user_id
      WHERE pr.referral_code=v_referral_code AND pr.user_id IS NOT NULL
        AND (v_is_manager OR pca.mentor_user_id=auth.uid())
      ORDER BY pr.user_id, pr.created_at DESC
    ) u
    LEFT JOIN profiles prof ON prof.id=u.user_id
    LEFT JOIN partner_sharing_consents psc ON psc.user_id=u.user_id AND psc.partner_id=v_partner_id
    LEFT JOIN LATERAL (
      SELECT cd.form_data FROM cv_documents cd WHERE cd.user_id=u.user_id ORDER BY cd.created_at DESC LIMIT 1
    ) latest ON true
    ORDER BY u.joined_at DESC, u.user_id
    LIMIT v_limit OFFSET v_offset
  ) pg;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$func$;

REVOKE ALL ON FUNCTION get_partner_referred_clients(int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_partner_referred_clients(int, int) TO authenticated;

-- K3. get_partner_referred_cv(p_client_ref)
-- LIVE base: migration 033. Added: mentor must be assigned to this client.
CREATE OR REPLACE FUNCTION get_partner_referred_cv(p_client_ref uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_partner_id     uuid;
  v_referral_code  text;
  v_is_manager     boolean;
  v_client_user_id uuid;
  v_html           text;
BEGIN
  SELECT p.id, p.referral_code INTO v_partner_id, v_referral_code
  FROM partner_members pm JOIN partners p ON p.id=pm.partner_id
  WHERE pm.user_id=auth.uid() AND p.is_active=true LIMIT 1;

  IF v_partner_id IS NULL THEN RAISE EXCEPTION 'not a partner member'; END IF;

  -- ADDED
  SELECT pm.role IN ('owner','manager') INTO v_is_manager
  FROM   partner_members pm WHERE pm.user_id=auth.uid() AND pm.partner_id=v_partner_id;

  SELECT pr.user_id INTO v_client_user_id
  FROM partner_referrals pr
  JOIN partner_sharing_consents psc ON psc.user_id=pr.user_id AND psc.partner_id=v_partner_id
  WHERE pr.id=p_client_ref AND pr.referral_code=v_referral_code AND psc.withdrawn_at IS NULL LIMIT 1;

  IF v_client_user_id IS NULL THEN RAISE EXCEPTION 'client has not shared their CV'; END IF;

  -- ADDED: mentor assignment gate
  IF NOT v_is_manager THEN
    IF NOT EXISTS (SELECT 1 FROM partner_client_assignments
                   WHERE partner_id=v_partner_id AND client_user_id=v_client_user_id AND mentor_user_id=auth.uid())
    THEN RAISE EXCEPTION 'mentors may only access clients assigned to them'; END IF;
  END IF;

  SELECT cv_content->>'english' INTO v_html FROM cv_documents
  WHERE user_id=v_client_user_id AND cv_content IS NOT NULL
    AND cv_content->>'english' IS NOT NULL AND cv_content->>'english'<>''
  ORDER BY created_at DESC LIMIT 1;

  IF v_html IS NULL OR v_html='' THEN
    SELECT c.cv_english->>'html' INTO v_html FROM candidates c
    WHERE c.user_id=v_client_user_id AND c.is_active=true AND c.cv_english IS NOT NULL
    ORDER BY c.opted_in_at DESC LIMIT 1;
  END IF;

  IF v_html IS NULL OR v_html='' THEN RAISE EXCEPTION 'no CV available'; END IF;

  RETURN v_html;
END;
$func$;

REVOKE ALL ON FUNCTION get_partner_referred_cv(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_partner_referred_cv(uuid) TO authenticated;

-- K4. get_partner_referred_cover_letters(p_client_ref)
-- LIVE base: migration 033. Added: mentor must be assigned to this client.
CREATE OR REPLACE FUNCTION get_partner_referred_cover_letters(p_client_ref uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_partner_id     uuid;
  v_referral_code  text;
  v_is_manager     boolean;
  v_client_user_id uuid;
BEGIN
  SELECT p.id, p.referral_code INTO v_partner_id, v_referral_code
  FROM partner_members pm JOIN partners p ON p.id=pm.partner_id
  WHERE pm.user_id=auth.uid() AND p.is_active=true LIMIT 1;

  IF v_partner_id IS NULL THEN RAISE EXCEPTION 'not a partner member'; END IF;

  -- ADDED
  SELECT pm.role IN ('owner','manager') INTO v_is_manager
  FROM   partner_members pm WHERE pm.user_id=auth.uid() AND pm.partner_id=v_partner_id;

  SELECT pr.user_id INTO v_client_user_id
  FROM partner_referrals pr
  JOIN partner_sharing_consents psc ON psc.user_id=pr.user_id AND psc.partner_id=v_partner_id
  WHERE pr.id=p_client_ref AND pr.referral_code=v_referral_code
    AND psc.withdrawn_at IS NULL AND psc.scope='full' LIMIT 1;

  IF v_client_user_id IS NULL THEN RAISE EXCEPTION 'client has not agreed to share cover letters'; END IF;

  -- ADDED: mentor assignment gate
  IF NOT v_is_manager THEN
    IF NOT EXISTS (SELECT 1 FROM partner_client_assignments
                   WHERE partner_id=v_partner_id AND client_user_id=v_client_user_id AND mentor_user_id=auth.uid())
    THEN RAISE EXCEPTION 'mentors may only access clients assigned to them'; END IF;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id',cl.id,'job_title',cl.job_title,'company',cl.company,'language',cl.language,
      'english_text',cl.english_text,'native_text',cl.native_text,'created_at',cl.created_at
    ) ORDER BY cl.created_at DESC),'[]'::jsonb)
    FROM cover_letters cl WHERE cl.user_id=v_client_user_id
  );
END;
$func$;

REVOKE ALL ON FUNCTION get_partner_referred_cover_letters(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_partner_referred_cover_letters(uuid) TO authenticated;

-- K5. partner_update_referred_cover_letter(p_letter_id, p_english_text, p_native_text)
-- LIVE base: migration 033. Added: mentor must be assigned to this client.
CREATE OR REPLACE FUNCTION partner_update_referred_cover_letter(
  p_letter_id uuid, p_english_text text, p_native_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_partner_id     uuid;
  v_referral_code  text;
  v_is_manager     boolean;
  v_client_user_id uuid;
  v_prev_english   text;
  v_prev_native    text;
BEGIN
  SELECT p.id, p.referral_code INTO v_partner_id, v_referral_code
  FROM partner_members pm JOIN partners p ON p.id=pm.partner_id
  WHERE pm.user_id=auth.uid() AND p.is_active=true LIMIT 1;

  IF v_partner_id IS NULL THEN RAISE EXCEPTION 'not a partner member'; END IF;

  -- ADDED
  SELECT pm.role IN ('owner','manager') INTO v_is_manager
  FROM   partner_members pm WHERE pm.user_id=auth.uid() AND pm.partner_id=v_partner_id;

  IF p_english_text IS NULL OR btrim(p_english_text)='' THEN RAISE EXCEPTION 'english_text must not be empty'; END IF;
  IF length(p_english_text)>10000 THEN RAISE EXCEPTION 'english_text exceeds 10000 character limit'; END IF;
  IF length(coalesce(p_native_text,''))>10000 THEN RAISE EXCEPTION 'native_text exceeds 10000 character limit'; END IF;

  SELECT cl.user_id, cl.english_text, cl.native_text INTO v_client_user_id, v_prev_english, v_prev_native
  FROM cover_letters cl
  JOIN partner_referrals pr ON pr.user_id=cl.user_id
  JOIN partner_sharing_consents psc ON psc.user_id=cl.user_id AND psc.partner_id=v_partner_id
  WHERE cl.id=p_letter_id AND pr.referral_code=v_referral_code
    AND psc.withdrawn_at IS NULL AND psc.scope='full' LIMIT 1;

  IF v_client_user_id IS NULL THEN RAISE EXCEPTION 'client has not agreed to share cover letters'; END IF;

  -- ADDED: mentor assignment gate
  IF NOT v_is_manager THEN
    IF NOT EXISTS (SELECT 1 FROM partner_client_assignments
                   WHERE partner_id=v_partner_id AND client_user_id=v_client_user_id AND mentor_user_id=auth.uid())
    THEN RAISE EXCEPTION 'mentors may only update cover letters for clients assigned to them'; END IF;
  END IF;

  UPDATE cover_letters SET english_text=p_english_text, native_text=p_native_text WHERE id=p_letter_id;

  INSERT INTO partner_edit_events
    (partner_id, editor_user_id, candidate_id, client_user_id, cover_letter_id, previous_english_text, previous_native_text)
  VALUES (v_partner_id, auth.uid(), NULL, v_client_user_id, p_letter_id, v_prev_english, v_prev_native);
END;
$func$;

REVOKE ALL ON FUNCTION partner_update_referred_cover_letter(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION partner_update_referred_cover_letter(uuid, text, text) TO authenticated;

-- K6. get_partner_dashboard_data()
-- LIVE base: production. Line-level changes listed at bottom.
CREATE OR REPLACE FUNCTION get_partner_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_partner           partners%ROWTYPE;
  v_member_role       text;
  v_is_manager        boolean;
  v_member_count      int;
  v_total_cvs         int;
  v_month_cvs         int;
  v_active_this_month int;
  v_candidates        int;
  v_lang_breakdown    jsonb;
  v_job_breakdown     jsonb;
  -- v_recent_candidates removed
BEGIN
  SELECT p.id, p.user_id, p.name, p.email, p.referral_code, p.is_active, p.created_at, pm.role
  INTO v_partner.id, v_partner.user_id, v_partner.name, v_partner.email,
       v_partner.referral_code, v_partner.is_active, v_partner.created_at, v_member_role
  FROM partner_members pm JOIN partners p ON p.id=pm.partner_id
  WHERE pm.user_id=auth.uid() AND p.is_active=true LIMIT 1;

  IF v_partner.id IS NULL THEN RETURN NULL; END IF;

  v_is_manager := v_member_role IN ('owner', 'manager');

  -- ADDED: mentor early-return with limited payload
  IF NOT v_is_manager THEN
    RETURN jsonb_build_object(
      'partner_id',       v_partner.id,
      'partner_name',     v_partner.name,
      'partner_logo_url', (SELECT logo_url FROM partners WHERE id=v_partner.id),
      'referral_code',    v_partner.referral_code,
      'member_role',      v_member_role,
      'my_assigned',      (SELECT COUNT(*)::int FROM partner_client_assignments
                           WHERE partner_id=v_partner.id AND mentor_user_id=auth.uid() AND status='active'),
      'my_closed',        (SELECT COUNT(*)::int FROM partner_client_assignments
                           WHERE partner_id=v_partner.id AND mentor_user_id=auth.uid() AND status='closed')
    );
  END IF;

  SELECT COUNT(*)::int INTO v_member_count FROM partner_members WHERE partner_id=v_partner.id;

  SELECT COUNT(*)::int INTO v_total_cvs FROM cv_documents cd
  JOIN partner_referrals pr ON pr.user_id=cd.user_id WHERE pr.referral_code=v_partner.referral_code;

  SELECT COUNT(*)::int INTO v_month_cvs FROM cv_documents cd
  JOIN partner_referrals pr ON pr.user_id=cd.user_id
  WHERE pr.referral_code=v_partner.referral_code AND cd.created_at>=date_trunc('month',now());

  SELECT COUNT(DISTINCT c.user_id)::int INTO v_active_this_month FROM candidates c
  JOIN cv_documents cd ON cd.user_id=c.user_id
  WHERE c.referral_source=v_partner.referral_code AND c.is_active=true AND cd.created_at>=date_trunc('month',now());

  SELECT COUNT(*)::int INTO v_candidates FROM candidates
  WHERE referral_source=v_partner.referral_code AND is_active=true;

  SELECT jsonb_object_agg(lang,cnt) INTO v_lang_breakdown FROM (
    SELECT language AS lang, COUNT(*)::int AS cnt FROM candidates
    WHERE referral_source=v_partner.referral_code AND is_active=true
    GROUP BY language ORDER BY cnt DESC LIMIT 10
  ) sub;

  SELECT jsonb_object_agg(jt,cnt) INTO v_job_breakdown FROM (
    SELECT jt, COUNT(*)::int AS cnt FROM candidates, unnest(job_types) AS jt
    WHERE referral_source=v_partner.referral_code AND is_active=true
    GROUP BY jt ORDER BY cnt DESC LIMIT 10
  ) sub;

  -- v_recent_candidates SELECT removed

  RETURN jsonb_build_object(
    'partner_id',          v_partner.id,
    'partner_name',        v_partner.name,
    'partner_logo_url',    (SELECT logo_url FROM partners WHERE id=v_partner.id),
    'referral_code',       v_partner.referral_code,
    'member_role',         v_member_role,
    'member_count',        v_member_count,
    'total_cvs',           v_total_cvs,
    'month_cvs',           v_month_cvs,
    'active_this_month',   v_active_this_month,
    'total_candidates',    v_candidates,
    'lang_breakdown',      COALESCE(v_lang_breakdown,'{}'::jsonb),
    'job_breakdown',       COALESCE(v_job_breakdown,'{}'::jsonb)
    -- 'recent_candidates' removed
  );
END;
$function$;

REVOKE ALL ON FUNCTION get_partner_dashboard_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_partner_dashboard_data() TO authenticated;

-- K7. claim_partner_account()
-- LIVE base: production. Line-level changes listed at bottom.
CREATE OR REPLACE FUNCTION claim_partner_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_email      text;
  v_partner_id      uuid;
  v_referral_code   text;
  v_member_id       uuid;
  -- ADDED:
  v_partner_email   text;
  v_allowed_domains text[];
  v_email_domain    text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id=auth.uid();
  IF v_user_email IS NULL THEN RETURN NULL; END IF;

  -- 1. Already-claimed (unchanged)
  SELECT p.id, p.referral_code INTO v_partner_id, v_referral_code
  FROM partner_members pm JOIN partners p ON p.id=pm.partner_id
  WHERE pm.user_id=auth.uid() AND p.is_active=true LIMIT 1;

  IF v_partner_id IS NOT NULL THEN RETURN v_referral_code; END IF;

  -- 2. First-login owner (unchanged)
  SELECT id, referral_code INTO v_partner_id, v_referral_code FROM partners
  WHERE email=v_user_email AND is_active=true AND user_id IS NULL LIMIT 1;

  IF v_partner_id IS NOT NULL THEN
    UPDATE partners SET user_id=auth.uid() WHERE id=v_partner_id;
    UPDATE profiles SET role='partner' WHERE id=auth.uid();
    INSERT INTO partner_members (partner_id, user_id, email, role)
    VALUES (v_partner_id, auth.uid(), v_user_email, 'owner')
    ON CONFLICT (partner_id, email) DO UPDATE SET user_id=auth.uid();
    RETURN v_referral_code;
  END IF;

  -- 3. First-login invited member (mentor or manager).
  SELECT pm.id, p.id, p.referral_code INTO v_member_id, v_partner_id, v_referral_code
  FROM partner_members pm JOIN partners p ON p.id=pm.partner_id
  WHERE pm.email=v_user_email AND pm.user_id IS NULL AND p.is_active=true LIMIT 1;

  IF v_member_id IS NOT NULL THEN
    -- ADDED: domain check; return NULL on fail (login screen shows "no partner account")
    SELECT p.email, p.allowed_email_domains INTO v_partner_email, v_allowed_domains
    FROM   partners p WHERE p.id=v_partner_id;

    IF v_allowed_domains IS NOT NULL AND array_length(v_allowed_domains,1) > 0 THEN
      IF lower(v_user_email) != lower(COALESCE(v_partner_email,'')) THEN
        v_email_domain := split_part(lower(v_user_email),'@',2);
        IF NOT (v_email_domain = ANY(v_allowed_domains)) THEN
          RETURN NULL;
        END IF;
      END IF;
    END IF;

    UPDATE partner_members SET user_id=auth.uid() WHERE id=v_member_id;
    UPDATE profiles SET role='partner' WHERE id=auth.uid();

    -- ADDED: activity log
    INSERT INTO partner_activity_log (partner_id, actor_user_id, action, details)
    VALUES (v_partner_id, auth.uid(), 'member_claimed', jsonb_build_object('email',v_user_email));

    RETURN v_referral_code;
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION claim_partner_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_partner_account() TO authenticated;
