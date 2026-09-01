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
  delay_seconds: number;
  hourly_limit: number;
  lead_count: number;
  start_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  leads: string[];
}

export interface ScheduleEmailResponse {
  success: boolean;
  campaignId: string;
  leadCount: number;
  message: string;
}
