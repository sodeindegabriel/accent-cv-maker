-- Migration 014: two-tier admin roles + pending_admin_invites + claim flow
-- Run in Supabase SQL editor AFTER migration 013.

-- ── 1. Add 'super_admin' to profiles.role check constraint ───────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'partner', 'super_admin'));

-- ── 2. is_admin() — true for both 'admin' and 'super_admin' ──────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ── 3. is_super_admin() — true only for 'super_admin' ────────────────────────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- ── 4. pending_admin_invites table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_admin_invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL UNIQUE,
  role       text        NOT NULL CHECK (role IN ('admin', 'super_admin')),
  invited_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pending_admin_invites ENABLE ROW LEVEL SECURITY;

-- All admins can view pending invites
CREATE POLICY "admins see pending admin invites"
  ON pending_admin_invites FOR SELECT TO authenticated
  USING (is_admin());

-- Super admins can insert/update/delete (enforced in function; policy is extra safety)
CREATE POLICY "super admins manage pending admin invites"
  ON pending_admin_invites FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

GRANT SELECT, INSERT, DELETE ON pending_admin_invites TO authenticated;

-- ── 5. list_admins() — returns current admin + super_admin users ──────────────
CREATE OR REPLACE FUNCTION list_admins()
RETURNS TABLE (id uuid, email text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT p.id, u.email::text, p.role
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role IN ('admin', 'super_admin')
  ORDER BY p.role DESC, u.email;
END;
$$;

GRANT EXECUTE ON FUNCTION list_admins() TO authenticated;

-- ── 6. claim_admin_account() — called after OTP verify for new admins ─────────
-- Checks pending_admin_invites by the logged-in user's email.
-- If found: sets profiles.role, removes the invite, returns the granted role.
-- Returns NULL if no pending invite (no-op for existing admins).
CREATE OR REPLACE FUNCTION claim_admin_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_role  text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN RETURN NULL; END IF;

  SELECT role INTO v_role
  FROM pending_admin_invites
  WHERE email = v_email
  LIMIT 1;

  IF v_role IS NULL THEN RETURN NULL; END IF;

  UPDATE profiles SET role = v_role WHERE id = auth.uid();
  DELETE FROM pending_admin_invites WHERE email = v_email;

  RETURN v_role;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_admin_account() TO authenticated;

-- ── 7. invite_admin(email, role) — super_admin only ──────────────────────────
-- Upserts a pending invite (overwrites if email already has a pending invite).
CREATE OR REPLACE FUNCTION invite_admin(p_email text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can invite admins';
  END IF;

  IF p_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Role must be admin or super_admin';
  END IF;

  -- Prevent inviting someone who is already an admin/super_admin
  IF EXISTS (
    SELECT 1 FROM profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.email = lower(p_email)
      AND p.role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'This user is already an admin';
  END IF;

  INSERT INTO pending_admin_invites (email, role, invited_by)
  VALUES (lower(p_email), p_role, auth.uid())
  ON CONFLICT (email) DO UPDATE
    SET role = p_role, invited_by = auth.uid(), created_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION invite_admin(text, text) TO authenticated;

-- ── 8. demote_admin(target_user_id) — super_admin only ───────────────────────
-- Reverts a user's role to 'user'. Guards against removing the last super_admin.
CREATE OR REPLACE FUNCTION demote_admin(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role text;
  v_super_count int;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can demote admins';
  END IF;

  IF p_target_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot demote yourself';
  END IF;

  SELECT role INTO v_target_role FROM profiles WHERE id = p_target_id;

  IF v_target_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;

  IF v_target_role = 'super_admin' THEN
    SELECT COUNT(*) INTO v_super_count FROM profiles WHERE role = 'super_admin';
    IF v_super_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last super admin';
    END IF;
  END IF;

  UPDATE profiles SET role = 'user' WHERE id = p_target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION demote_admin(uuid) TO authenticated;

-- ── 9. Elevate hello@cvlingo.com to super_admin ───────────────────────────────
UPDATE profiles
SET role = 'super_admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'hello@cvlingo.com'
);
