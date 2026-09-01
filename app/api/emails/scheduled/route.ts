import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import type { EmailRow } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ emails: [] }, { status: 200 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json({ emails: [] }, { status: 200 });
    }

    const { data, error } = await supabaseServer
      .from('emails')
      .select('*')
      .eq('status', 'scheduled')
      .eq('user_id', userData.user.id)
      .order('start_time', { ascending: true });

    if (error) {
      return NextResponse.json({ emails: [] }, { status: 200 });
    }

    return NextResponse.json({ emails: (data as EmailRow[]) || [] }, { status: 200 });
  } catch {
    return NextResponse.json({ emails: [] }, { status: 200 });
  }
}
