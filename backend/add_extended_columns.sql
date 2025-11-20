-- Migration SQL script to add extended candidate fields to candidates table
-- Run this in Render Dashboard → Database → SQL Editor

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS motivation_reason TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS test_results TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS years_experience INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS skill_tags TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS prior_job_titles TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education_level VARCHAR;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location VARCHAR;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS communication_level VARCHAR;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS availability_per_week INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notice_period VARCHAR;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_expectation INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source VARCHAR;