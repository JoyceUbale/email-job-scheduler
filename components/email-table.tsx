'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/providers';
import { supabase } from '@/lib/supabase';
import type { EmailRow, EmailStatus } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail,
  Clock,
  CheckCircle2,
  Trash2,
  Send,
  CalendarClock,
  Inbox,
  Users,
  Timer,
  Gauge,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface EmailTableProps {
  status: EmailStatus;
}

export function EmailTable({ status }: EmailTableProps) {
  const { session } = useAuth();
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = status === 'scheduled' ? '/api/emails/scheduled' : '/api/emails/sent';
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setEmails(data.emails || []);
    } catch {
      toast.error('Failed to load emails');
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [status, session]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from('emails').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete email');
    } else {
      toast.success('Email deleted');
      fetchEmails();
    }
  }

  async function handleSendNow(email: EmailRow) {
    const { error } = await supabase
      .from('emails')
      .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', email.id);
    if (error) {
      toast.error('Failed to send email');
    } else {
      toast.success('Email sent!', { description: `Sent to ${email.recipient}` });
      fetchEmails();
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '--';
    try {
      return format(parseISO(iso), 'MMM d, yyyy • h:mm a');
    } catch {
      return iso;
    }
  }

  const isScheduled = status === 'scheduled';

  // Loading skeletons
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-lg border border-border bg-card/50 p-4"
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 px-6 py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          {isScheduled ? (
            <CalendarClock className="h-8 w-8 text-muted-foreground" />
          ) : (
            <Inbox className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          {isScheduled ? 'No scheduled campaigns' : 'No sent campaigns yet'}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {isScheduled
            ? 'Compose a new email campaign and schedule it to see it here. Your scheduled campaigns will appear in this list.'
            : 'Once your campaigns are sent, they will show up here with delivery details and timestamps.'}
        </p>
      </div>
    );
  }

  // Data table
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-[25%]">Subject</TableHead>
            <TableHead className="w-[15%]">First Recipient</TableHead>
            <TableHead className="w-[80px]">Leads</TableHead>
            <TableHead className="w-[80px]">Delay</TableHead>
            <TableHead className="w-[80px]">Hrly Limit</TableHead>
            <TableHead className="w-[170px]">
              {isScheduled ? 'Start Time' : 'Sent At'}
            </TableHead>
            <TableHead className="w-[90px]">Status</TableHead>
            <TableHead className="w-[80px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {emails.map((email) => (
            <TableRow
              key={email.id}
              className="group border-border transition-colors hover:bg-muted/30"
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{email.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {email.body.slice(0, 60)}
                      {email.body.length > 60 ? '...' : ''}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <p className="truncate text-sm text-foreground">{email.recipient}</p>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary">
                  <Users className="h-3 w-3" />
                  {email.lead_count}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  {email.delay_seconds}s
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Gauge className="h-3 w-3" />
                  {email.hourly_limit}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {isScheduled ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  )}
                  <span className="text-xs">
                    {formatDate(isScheduled ? email.start_time || email.scheduled_for : email.sent_at)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    isScheduled
                      ? 'border-warning/30 bg-warning/10 text-warning'
                      : 'border-success/30 bg-success/10 text-success'
                  }
                >
                  {isScheduled ? (
                    <>
                      <Clock className="mr-1 h-3 w-3" />
                      Scheduled
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Sent
                    </>
                  )}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                  {isScheduled && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-primary/15 hover:text-primary"
                      onClick={() => handleSendNow(email)}
                      title="Send now"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive"
                    onClick={() => handleDelete(email.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
