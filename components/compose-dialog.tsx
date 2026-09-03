'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/providers';
import { supabase } from '@/lib/supabase';
import type { ScheduleEmailResponse } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  PenSquare,
  Upload,
  FileText,
  X,
  Gauge,
  Timer,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ComposeDialog({ open, onOpenChange, onSaved }: ComposeDialogProps) {
  const { session } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState('AM');
  const [delaySeconds, setDelaySeconds] = useState('60');
  const [hourlyLimit, setHourlyLimit] = useState('30');
  const [leads, setLeads] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSubject('');
      setBody('');
      setDate(undefined);
      setHour('09');
      setMinute('00');
      setAmpm('AM');
      setDelaySeconds('60');
      setHourlyLimit('30');
      setLeads([]);
      setFileName('');
      setErrors({});
    }
  }, [open]);

  function parseFileContent(text: string) {
    setParsing(true);
    setTimeout(() => {
      const matches = text.match(EMAIL_REGEX) || [];
      const unique = Array.from(new Set(matches.map((e) => e.toLowerCase())));
      setLeads(unique);
      setParsing(false);
      if (unique.length > 0) {
        toast.success(`${unique.length} valid email${unique.length === 1 ? '' : 's'} detected`);
      } else {
        toast.error('No valid email addresses found in file');
      }
    }, 300);
  }

  async function handleFileUpload(file: File) {
    const validTypes = ['.csv', '.txt'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(ext)) {
      toast.error('Please upload a .csv or .txt file');
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    parseFileContent(text);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }

  function clearFile() {
    setLeads([]);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function getStartTimeISO(): string | null {
    if (!date) return null;
    let h = parseInt(hour, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const d = new Date(date);
    d.setHours(h, parseInt(minute, 10), 0, 0);
    return d.toISOString();
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!subject.trim()) errs.subject = 'Subject is required';
    if (!body.trim()) errs.body = 'Email body is required';
    if (!date) errs.startTime = 'Start time is required';
    const delay = parseInt(delaySeconds, 10);
    if (isNaN(delay) || delay < 0) errs.delay = 'Must be 0 or greater';
    const limit = parseInt(hourlyLimit, 10);
    if (isNaN(limit) || limit < 1) errs.hourlyLimit = 'Must be at least 1';
    if (leads.length === 0) errs.leads = 'Upload a lead file with valid emails';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function getOrCreateSenderConfig(userId: string, userEmail: string): Promise<string | number> {
    // 1. Fetch existing sender config
    const { data: existing } = await supabase
      .from('sender_configs')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (existing?.id) return existing.id;

    // 2. Create sender config if absent
    const { data: inserted, error } = await supabase
      .from('sender_configs')
      .insert([{ user_id: userId, email: userEmail, is_active: true }])
      .select('id')
      .single();

    if (error || !inserted?.id) {
      throw new Error(`Failed to configure sender email: ${error?.message || 'Unknown database error'}`);
    }

    return inserted.id;
  }

  async function handleSubmit() {
    if (!validate()) {
      toast.error('Please fix the errors before submitting');
      return;
    }
    const startTime = getStartTimeISO();
    if (!startTime) return;

    setSaving(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const activeSession = currentSession || session;
      const userId = activeSession?.user?.id;
      const userEmail = activeSession?.user?.email || 'user@example.com';

      if (!userId) {
        throw new Error('User session not found. Please log in again.');
      }

      // Fetch or create required senderConfigId
      const senderConfigId = await getOrCreateSenderConfig(userId, userEmail);

      const payload = {
        userId,
        subject: subject.trim(),
        body: body.trim(),
        startTime,
        delaySeconds: parseInt(delaySeconds, 10),
        hourlyLimit: parseInt(hourlyLimit, 10),
        leads,
        senderConfigId,
      };

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/api/schedule-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeSession?.access_token || ''}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let data: ScheduleEmailResponse;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Server status ${response.status}: ${responseText}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to schedule campaign');
      }

      toast.success('Campaign scheduled!', {
        description: data.message,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to schedule campaign', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border bg-card/95 backdrop-blur-xl scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <PenSquare className="h-4 w-4 text-primary" />
            </div>
            Compose New Email
          </DialogTitle>
          <DialogDescription>
            Write your email, upload leads, and schedule a campaign with throttling controls.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Email Subject *</Label>
            <Input
              id="subject"
              type="text"
              placeholder="Your email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={errors.subject ? 'border-destructive' : ''}
            />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Email Body *</Label>
            <Textarea
              id="body"
              placeholder="Write your email content here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={`min-h-[120px] ${errors.body ? 'border-destructive' : ''}`}
            />
            {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Start Time *</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`gap-2 ${errors.startTime ? 'border-destructive' : ''}`}
                  >
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
            {errors.startTime && <p className="text-xs text-destructive">{errors.startTime}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="delay" className="flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                Delay Between Emails (seconds) *
              </Label>
              <Input
                id="delay"
                type="number"
                min="0"
                placeholder="60"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value)}
                className={errors.delay ? 'border-destructive' : ''}
              />
              {errors.delay && <p className="text-xs text-destructive">{errors.delay}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hourly-limit" className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                Hourly Limit per Sender *
              </Label>
              <Input
                id="hourly-limit"
                type="number"
                min="1"
                placeholder="30"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                className={errors.hourlyLimit ? 'border-destructive' : ''}
              />
              {errors.hourlyLimit && <p className="text-xs text-destructive">{errors.hourlyLimit}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
              Lead File (.csv or .txt) *
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            {!fileName ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : errors.leads
                      ? 'border-destructive/50 hover:border-destructive'
                      : 'border-border hover:border-primary/50'
                }`}
              >
                <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop your file here or click to browse
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">.csv or .txt files only</p>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
                    {parsing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {parsing ? 'Parsing...' : `${leads.length} valid email${leads.length === 1 ? '' : 's'} detected`}
                    </p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={clearFile}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {errors.leads && <p className="text-xs text-destructive">{errors.leads}</p>}
          </div>

          {leads.length > 0 && !parsing && (
            <div className="flex items-center gap-2">
              <Badge className="gap-1.5 border-success/30 bg-success/10 text-success">
                <Users className="h-3 w-3" />
                {leads.length} valid email{leads.length === 1 ? '' : 's'} detected
              </Badge>
              {leads.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  First: {leads[0]}
                  {leads.length > 1 && ` · Last: ${leads[leads.length - 1]}`}
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || parsing}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <CalendarIcon className="mr-2 h-4 w-4" />
                Schedule Campaign
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}