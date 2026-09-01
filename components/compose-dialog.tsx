'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { EmailRow } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Calendar as CalendarIcon, Clock, PenSquare, Send } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editEmail?: EmailRow | null;
  onSaved?: () => void;
}

export function ComposeDialog({ open, onOpenChange, editEmail, onSaved }: ComposeDialogProps) {
  const [recipient, setRecipient] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState('AM');
  const [saving, setSaving] = useState(false);

  const isEditing = !!editEmail;

  useEffect(() => {
    if (editEmail) {
      setRecipient(editEmail.recipient);
      setRecipientName(editEmail.recipient_name || '');
      setSubject(editEmail.subject);
      setBody(editEmail.body);
      const d = new Date(editEmail.scheduled_for);
      setDate(d);
      let h = d.getHours();
      const ampmVal = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      setHour(String(h).padStart(2, '0'));
      setMinute(String(d.getMinutes()).padStart(2, '0'));
      setAmpm(ampmVal);
    } else {
      setRecipient('');
      setRecipientName('');
      setSubject('');
      setBody('');
      setDate(undefined);
      setHour('09');
      setMinute('00');
      setAmpm('AM');
    }
  }, [editEmail, open]);

  function getScheduledForISO(): string | null {
    if (!date) return null;
    let h = parseInt(hour, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const d = new Date(date);
    d.setHours(h, parseInt(minute, 10), 0, 0);
    return d.toISOString();
  }

  async function handleSave() {
    if (!recipient.trim() || !subject.trim() || !body.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!date) {
      toast.error('Please select a date');
      return;
    }

    const scheduledFor = getScheduledForISO();
    if (!scheduledFor) return;

    setSaving(true);
    try {
      if (isEditing && editEmail) {
        const { error } = await supabase
          .from('emails')
          .update({
            recipient: recipient.trim(),
            recipient_name: recipientName.trim() || null,
            subject: subject.trim(),
            body: body.trim(),
            scheduled_for: scheduledFor,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editEmail.id);
        if (error) throw error;
        toast.success('Email updated', { description: 'Your scheduled email has been updated.' });
      } else {
        const { error } = await supabase.from('emails').insert({
          recipient: recipient.trim(),
          recipient_name: recipientName.trim() || null,
          subject: subject.trim(),
          body: body.trim(),
          status: 'scheduled',
          scheduled_for: scheduledFor,
        });
        if (error) throw error;
        toast.success('Email scheduled', {
          description: `Scheduled for ${format(new Date(scheduledFor), 'MMM d, yyyy • h:mm a')}`,
        });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to save email', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendNow() {
    if (!recipient.trim() || !subject.trim() || !body.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('emails').insert({
        recipient: recipient.trim(),
        recipient_name: recipientName.trim() || null,
        subject: subject.trim(),
        body: body.trim(),
        status: 'sent',
        scheduled_for: now,
        sent_at: now,
      });
      if (error) throw error;
      toast.success('Email sent!', { description: `Sent to ${recipient}` });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to send email', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <PenSquare className="h-4 w-4 text-primary" />
            </div>
            {isEditing ? 'Edit Scheduled Email' : 'Compose New Email'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the details of your scheduled email.'
              : 'Write a new email and schedule it to be sent later, or send it immediately.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Recipient */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="recipient">To *</Label>
              <Input
                id="recipient"
                type="email"
                placeholder="recipient@example.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipient-name">Recipient Name</Label>
              <Input
                id="recipient-name"
                type="text"
                placeholder="Jane Doe (optional)"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              type="text"
              placeholder="Your email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="body">Body *</Label>
            <Textarea
              id="body"
              placeholder="Write your email content here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[140px]"
            />
          </div>

          {/* Schedule */}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label>Schedule For</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {date ? format(date, 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>

                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Select value={hour} onValueChange={setHour}>
                    <SelectTrigger className="h-9 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(12)].map((_, i) => (
                        <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>
                          {String(i + 1).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">:</span>
                  <Select value={minute} onValueChange={setMinute}>
                    <SelectTrigger className="h-9 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['00', '15', '30', '45'].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={ampm} onValueChange={setAmpm}>
                    <SelectTrigger className="h-9 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {!isEditing && (
            <Button variant="outline" onClick={handleSendNow} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Now
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarIcon className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Update Email' : 'Schedule Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
