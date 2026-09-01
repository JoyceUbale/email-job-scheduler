/*
# Create emails table for ReachInbox

## Overview
Creates the `emails` table to store scheduled and sent emails for the ReachInbox
email scheduling service. Each email belongs to a user and tracks its lifecycle
from "scheduled" to "sent" status.

## New Tables
- `emails`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, defaults to auth.uid())
  - `recipient` (text, not null) — the "to" email address
  - `recipient_name` (text) — optional display name for the recipient
  - `subject` (text, not null) — email subject line
  - `body` (text, not null) — email body content
  - `status` (text, not null, default 'scheduled') — one of: 'scheduled', 'sent'
  - `scheduled_for` (timestamptz, not null) — when the email should be sent
  - `sent_at` (timestamptz) — when the email was actually sent (null if not sent yet)
  - `slack_notified` (boolean, default false) — whether a Slack notification was sent
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Indexes
- `idx_emails_user_id` on `user_id` for fast per-user queries
- `idx_emails_status` on `status` for filtering by scheduled/sent
- `idx_emails_scheduled_for` on `scheduled_for` for chronological ordering

## Security
- Enable RLS on `emails`.
- Owner-scoped CRUD: each authenticated user can only access rows they own.
- 4 separate policies for SELECT, INSERT, UPDATE, DELETE.
- `user_id` defaults to `auth.uid()` so inserts that omit it still satisfy the WITH CHECK.
*/

CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  slack_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_scheduled_for ON emails(scheduled_for);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_emails" ON emails;
CREATE POLICY "select_own_emails" ON emails FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_emails" ON emails;
CREATE POLICY "insert_own_emails" ON emails FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_emails" ON emails;
CREATE POLICY "update_own_emails" ON emails FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_emails" ON emails;
CREATE POLICY "delete_own_emails" ON emails FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
