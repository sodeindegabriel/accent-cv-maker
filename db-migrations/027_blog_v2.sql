-- Migration 027: Blog v2 — image storage, og image, SEO fields
-- Run in Supabase SQL editor AFTER migration 021 (blog_posts).

-- ── 1. blog-images storage bucket ────────────────────────────────────────────
-- Create the bucket if it doesn't exist (public = true means URLs are public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (anyone can view images)
CREATE POLICY "blog-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

-- Admin-only write
CREATE POLICY "blog-images admin insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'blog-images' AND (SELECT is_admin()));

CREATE POLICY "blog-images admin update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'blog-images' AND (SELECT is_admin()));

CREATE POLICY "blog-images admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'blog-images' AND (SELECT is_admin()));

-- ── 2. blog_posts schema additions ───────────────────────────────────────────
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS og_image_url      text,   -- JPEG for og:image/twitter:image
  ADD COLUMN IF NOT EXISTS cover_image_alt   text,   -- alt text for the WebP cover
  ADD COLUMN IF NOT EXISTS seo_title         text,   -- optional, falls back to title
  ADD COLUMN IF NOT EXISTS meta_description  text,   -- optional, falls back to excerpt
  ADD COLUMN IF NOT EXISTS focus_keyword     text;   -- admin-only, never in public meta
