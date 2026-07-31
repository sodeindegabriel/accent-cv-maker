-- Migration 008: validate cv_english / cv_native JSON shape on the candidates table
-- Ensures both columns, when present, are objects containing an "html" text key.
-- This is defense-in-depth against direct REST API abuse; the render-side
-- DOMPurify sanitization remains the primary XSS control.
-- Run in Supabase SQL editor.

ALTER TABLE candidates
  ADD CONSTRAINT candidates_cv_english_shape
    CHECK (cv_english IS NULL OR (
      jsonb_typeof(cv_english) = 'object'
      AND (cv_english->>'html') IS NOT NULL
    ));

ALTER TABLE candidates
  ADD CONSTRAINT candidates_cv_native_shape
    CHECK (cv_native IS NULL OR (
      jsonb_typeof(cv_native) = 'object'
      AND (cv_native->>'html') IS NOT NULL
    ));
