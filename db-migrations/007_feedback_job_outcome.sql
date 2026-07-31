-- Migration 007: add job_outcome column to feedback table
-- Run in Supabase SQL editor

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS job_outcome text
    CHECK (job_outcome IN ('yes', 'no', 'not_yet'));
