'use client';

import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface EmailTableProps {
  status: EmailStatus;
  onEdit?: (email: EmailRow) => void;
}

export function EmailTable({ status, onEdit }: EmailTableProps) {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('status', status)
      .order(status === 'scheduled' ? 'scheduled_for' : 'sent_at', { ascending: status === 'scheduled' });

    if (error) {
      toast.error('Failed to load emails');
      setEmails([]);
    } else {
      setEmails((data as EmailRow[]) || []);
    }
    setLoading(false);
  }, [status]);

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

  function formatDate(iso: string) {
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
          {isScheduled ? 'No scheduled emails' : 'No sent emails yet'}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {isScheduled
            ? 'Compose a new email and schedule it to see it here. Your scheduled emails will appear in this list.'
            : 'Once you send emails, they will show up here with delivery details and timestamps.'}
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
            <TableHead className="w-[30%]">Recipient</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead className="w-[180px]">
              {isScheduled ? 'Scheduled For' : 'Sent At'}
            </TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
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
                    <p className="truncate text-sm font-medium text-foreground">
                      {email.recipient_name || email.recipient}
                    </p>
                    {email.recipient_name && (
                      <p className="truncate text-xs text-muted-foreground">{email.recipient}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <p className="truncate text-sm text-foreground">{email.subject}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {email.body.slice(0, 80)}
                  {email.body.length > 80 ? '...' : ''}
                </p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {isScheduled ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  )}
                  <span className="text-xs">{formatDate(isScheduled ? email.scheduled_for : email.sent_at || email.updated_at)}</span>
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
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-primary/15 hover:text-primary"
                        onClick={() => onEdit?.(email)}
                        title="Edit"
                      >
                        <CalendarClock className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-primary/15 hover:text-primary"
                        onClick={() => handleSendNow(email)}
                        title="Send now"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </>
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
