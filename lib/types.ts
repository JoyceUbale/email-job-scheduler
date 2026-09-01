export type EmailStatus = 'scheduled' | 'sent';

export interface EmailRow {
  id: string;
  user_id: string;
  recipient: string;
  recipient_name: string | null;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduled_for: string;
  sent_at: string | null;
  slack_notified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}
