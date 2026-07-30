-- Store form input + generated CV content in cv_documents for edit/download flows.
-- Run in Supabase SQL editor BEFORE deploying the updated build/result/dashboard code.

-- 1. New columns on cv_documents
ALTER TABLE cv_documents
  ADD COLUMN IF NOT EXISTS form_data jsonb,   -- full CVData object (for Edit flow)
  ADD COLUMN IF NOT EXISTS cv_content jsonb;  -- GeneratedCV {native,english,language} (for Download)

-- 2. edit_events table (tracks CV regenerations; triggers can enforce a per-user limit later)
CREATE TABLE IF NOT EXISTS edit_events (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  cv_document_id uuid        REFERENCES cv_documents(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE edit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'edit_events' AND policyname = 'Users can insert own edit events'
  ) THEN
    CREATE POLICY "Users can insert own edit events"
      ON edit_events FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'edit_events' AND policyname = 'Users can view own edit events'
  ) THEN
    CREATE POLICY "Users can view own edit events"
      ON edit_events FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT ON edit_events TO authenticated;
