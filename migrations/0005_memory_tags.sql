-- Migration: Add tags to memories table for better categorization
ALTER TABLE memories ADD COLUMN tags TEXT;
