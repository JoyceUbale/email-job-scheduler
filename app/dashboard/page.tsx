'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Navbar } from '@/components/navbar';
import { EmailTable } from '@/components/email-table';
import { ComposeDialog } from '@/components/compose-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PenSquare, CalendarClock, CheckCircle2, Clock, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, session } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({ scheduled: 0, sent: 0, total: 0 });

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!session) return;
    async function loadStats() {
      try {
        const [scheduledRes, sentRes] = await Promise.all([
          fetch('/api/emails/scheduled', {
            headers: { Authorization: `Bearer ${session?.access_token || ''}` },
          }),
          fetch('/api/emails/sent', {
            headers: { Authorization: `Bearer ${session?.access_token || ''}` },
          }),
        ]);
        const scheduledData = await scheduledRes.json();
        const sentData = await sentRes.json();
        const sCount = scheduledData.emails?.length || 0;
        const tCount = sentData.emails?.length || 0;
        setStats({ scheduled: sCount, sent: tCount, total: sCount + tCount });
      } catch {
        // keep defaults
      }
    }
    loadStats();
  }, [session, refreshKey]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  function handleComposeNew() {
    setComposeOpen(true);
  }

  function handleSaved() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* Header section */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Schedule, track, and manage your outreach email campaigns.
            </p>
          </div>
          <Button onClick={handleComposeNew} size="lg" className="gap-2 shadow-lg shadow-primary/20">
            <PenSquare className="h-4 w-4" />
            Compose New Email
          </Button>
        </div>

        {/* Stats cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15">
                <CalendarClock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-xl font-bold text-foreground">{stats.scheduled}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-xl font-bold text-foreground">{stats.sent}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold text-foreground">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'scheduled' | 'sent')}>
          <TabsList className="mb-6 bg-muted/50">
            <TabsTrigger value="scheduled" className="gap-1.5">
              <CalendarClock className="h-4 w-4" />
              Scheduled Emails
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Sent Emails
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled">
            <EmailTable key={`scheduled-${refreshKey}`} status="scheduled" />
          </TabsContent>

          <TabsContent value="sent">
            <EmailTable key={`sent-${refreshKey}`} status="sent" />
          </TabsContent>
        </Tabs>
      </main>

      {/* Compose dialog */}
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSaved={handleSaved}
      />
    </div>
  );
}
