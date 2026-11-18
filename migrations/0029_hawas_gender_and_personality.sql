-- Migration: Hawas Gender and Personality Support
-- Enables gender detection, preferred name, zodiac, and custom personality per user

ALTER TABLE users ADD COLUMN gender TEXT DEFAULT 'unknown';
ALTER TABLE users ADD COLUMN preferred_name TEXT;
ALTER TABLE users ADD COLUMN zodiac TEXT;
ALTER TABLE users ADD COLUMN age_group TEXT;
ALTER TABLE users ADD COLUMN personality_notes TEXT;
