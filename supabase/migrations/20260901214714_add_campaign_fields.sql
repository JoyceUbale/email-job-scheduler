/*
# Add campaign fields to emails table

## Overview
Adds columns to the `emails` table to support campaign-level scheduling:
delay between emails, hourly limit per sender, and total lead count.

## Modified Tables
- `emails`
  - `delay_seconds` (integer, default 60) — delay between consecutive emails in seconds
  - `hourly_limit` (integer, default 30) — maximum emails per sender per hour
  - `lead_count` (integer, default 1) — number of valid email leads in this campaign
  - `start_time` (timestamptz) — when the campaign should start sending (replaces scheduled_for for campaigns)

## Security
- No RLS policy changes — existing owner-scoped policies still apply to new columns.
*/

ALTER TABLE emails ADD COLUMN IF NOT EXISTS delay_seconds integer NOT NULL DEFAULT 60;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS hourly_limit integer NOT NULL DEFAULT 30;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS lead_count integer NOT NULL DEFAULT 1;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS start_time timestamptz;

CREATE INDEX IF NOT EXISTS idx_emails_start_time ON emails(start_time);
