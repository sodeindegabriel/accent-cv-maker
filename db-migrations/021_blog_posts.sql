-- Migration 021: blog_posts table
-- Run in Supabase SQL editor after migration 020.

-- ── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text        NOT NULL UNIQUE,
  title            text        NOT NULL,
  excerpt          text,
  content          text        NOT NULL DEFAULT '',
  cover_image_url  text,
  author_name      text,
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'published')),
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── 2. updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS blog_posts_updated_at ON blog_posts;
CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated): only published posts
CREATE POLICY "public reads published blog posts"
  ON blog_posts FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Admins bypass the published filter and can do everything
CREATE POLICY "admins full access to blog posts"
  ON blog_posts FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── 4. Grants ────────────────────────────────────────────────────────────────
-- Explicit grants are required alongside RLS — silent 403s occur without them.
GRANT SELECT ON blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON blog_posts TO authenticated;
