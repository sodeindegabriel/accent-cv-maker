-- Migration 015: direct role assignment tool for super admins
-- Run in Supabase SQL editor AFTER migration 014.

-- ── 1. find_user_by_email() — look up a user's current role by email ──────────
-- Returns 0 rows if no account exists, 1 row if found.
-- Super admin only.
CREATE OR REPLACE FUNCTION find_user_by_email(p_email text)
RETURNS TABLE (id uuid, existing_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT p.id, p.role::text
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = lower(p_email)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION find_user_by_email(text) TO authenticated;

-- ── 2. set_user_role() — directly assign any role to a user by email ─────────
-- Guards: super_admin only; no self-demotion; no removing last super_admin.
CREATE OR REPLACE FUNCTION set_user_role(p_target_email text, p_new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id   uuid;
  v_target_role text;
  v_super_count int;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can set roles';
  END IF;

  IF p_new_role NOT IN ('user', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role — must be user, admin, or super_admin';
  END IF;

  SELECT p.id, p.role INTO v_target_id, v_target_role
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = lower(p_target_email)
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'No account found for this email';
  END IF;

  -- Prevent self-demotion
  IF v_target_id = auth.uid() AND p_new_role != 'super_admin' THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  -- Prevent removing the last super_admin
  IF v_target_role = 'super_admin' AND p_new_role != 'super_admin' THEN
    SELECT COUNT(*) INTO v_super_count FROM profiles WHERE role = 'super_admin';
    IF v_super_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last super admin';
    END IF;
  END IF;

  UPDATE profiles SET role = p_new_role WHERE id = v_target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_user_role(text, text) TO authenticated;
