-- Add referral_code to profiles + RLS policies for UPDATE/INSERT
-- Run in Supabase SQL editor BEFORE deploying the new dashboard code.

-- 1. referral_code column (unique, nullable — generated on first dashboard visit)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- 2. UPDATE policy — previously missing, caused silent failure on language persist fix
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON profiles FOR UPDATE TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 3. INSERT policy — needed for upsert on first sign-in
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON profiles FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
