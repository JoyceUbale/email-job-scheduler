import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import type { ScheduleEmailPayload, ScheduleEmailResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as ScheduleEmailPayload;

    // Server-side validation
    if (!payload.subject?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Email subject is required' },
        { status: 400 }
      );
    }
    if (!payload.body?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Email body is required' },
        { status: 400 }
      );
    }
    if (!payload.startTime) {
      return NextResponse.json(
        { success: false, message: 'Start time is required' },
        { status: 400 }
      );
    }
    if (!payload.leads || payload.leads.length === 0) {
      return NextResponse.json(
        { success: false, message: 'At least one lead email is required' },
        { status: 400 }
      );
    }
    if (payload.delaySeconds < 0) {
      return NextResponse.json(
        { success: false, message: 'Delay must be 0 or greater' },
        { status: 400 }
      );
    }
    if (payload.hourlyLimit < 1) {
      return NextResponse.json(
        { success: false, message: 'Hourly limit must be at least 1' },
        { status: 400 }
      );
    }

    // Get the authenticated user from the request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json(
        { success: false, message: 'Invalid authentication' },
        { status: 401 }
      );
    }

    const campaignId = crypto.randomUUID();
    const now = new Date().toISOString();
    const startTime = new Date(payload.startTime).toISOString();

    // Insert one row representing the campaign
    const { error } = await supabaseServer.from('emails').insert({
      user_id: userData.user.id,
      recipient: payload.leads[0],
      recipient_name: null,
      subject: payload.subject.trim(),
      body: payload.body.trim(),
      status: 'scheduled',
      scheduled_for: startTime,
      start_time: startTime,
      delay_seconds: payload.delaySeconds,
      hourly_limit: payload.hourlyLimit,
      lead_count: payload.leads.length,
      slack_notified: false,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: 'Failed to schedule campaign' },
        { status: 500 }
      );
    }

    const response: ScheduleEmailResponse = {
      success: true,
      campaignId,
      leadCount: payload.leads.length,
      message: `Campaign scheduled with ${payload.leads.length} lead${payload.leads.length === 1 ? '' : 's'}`,
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
