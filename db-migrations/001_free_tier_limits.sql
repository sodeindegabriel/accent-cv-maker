-- Free-tier limit enforcement
-- Run this in the Supabase SQL editor (Dashboard → SQL editor → New query)

-- ============================================================
-- 1. Max 2 CVs per user (cv_documents table)
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_cv_documents_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM cv_documents WHERE user_id = NEW.user_id) >= 2 THEN
    RAISE EXCEPTION 'cv_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cv_documents_limit ON cv_documents;
CREATE TRIGGER trg_cv_documents_limit
  BEFORE INSERT ON cv_documents
  FOR EACH ROW EXECUTE FUNCTION enforce_cv_documents_limit();

-- ============================================================
-- 2. Max 2 downloads per user (downloads table)
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_downloads_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM downloads WHERE user_id = NEW.user_id) >= 2 THEN
    RAISE EXCEPTION 'download_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_downloads_limit ON downloads;
CREATE TRIGGER trg_downloads_limit
  BEFORE INSERT ON downloads
  FOR EACH ROW EXECUTE FUNCTION enforce_downloads_limit();

-- ============================================================
-- 3. Edit events table + max 2 edits per user
-- ============================================================
CREATE TABLE IF NOT EXISTS edit_events (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cv_document_id uuid         REFERENCES cv_documents(id) ON DELETE SET NULL,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE edit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'edit_events' AND policyname = 'Users can insert own edit_events'
  ) THEN
    CREATE POLICY "Users can insert own edit_events"
      ON edit_events FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'edit_events' AND policyname = 'Users can select own edit_events'
  ) THEN
    CREATE POLICY "Users can select own edit_events"
      ON edit_events FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_edit_events_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM edit_events WHERE user_id = NEW.user_id) >= 2 THEN
    RAISE EXCEPTION 'edit_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_edit_events_limit ON edit_events;
CREATE TRIGGER trg_edit_events_limit
  BEFORE INSERT ON edit_events
  FOR EACH ROW EXECUTE FUNCTION enforce_edit_events_limit();
