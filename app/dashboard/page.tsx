'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Navbar } from '@/components/navbar';
import { EmailTable } from '@/components/email-table';
import { ComposeDialog } from '@/components/compose-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PenSquare, CalendarClock, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import type { EmailRow } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  const [editEmail, setEditEmail] = useState<EmailRow | null>(null);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [refreshKey, setRefreshKey] = useState(0);
  const tableRef = useRef<{ fetchEmails: () => void } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  function handleEdit(email: EmailRow) {
    setEditEmail(email);
    setComposeOpen(true);
  }

  function handleComposeNew() {
    setEditEmail(null);
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
              Schedule, track, and manage your outreach emails.
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
                <p className="text-xl font-bold text-foreground">--</p>
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
                <p className="text-xl font-bold text-foreground">--</p>
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
                <p className="text-xl font-bold text-foreground">--</p>
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
            <EmailTableWrapper
              key={`scheduled-${refreshKey}`}
              status="scheduled"
              onEdit={handleEdit}
            />
          </TabsContent>

          <TabsContent value="sent">
            <EmailTableWrapper key={`sent-${refreshKey}`} status="sent" />
          </TabsContent>
        </Tabs>
      </main>

      {/* Compose dialog */}
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        editEmail={editEmail}
        onSaved={handleSaved}
      />
    </div>
  );
}

// Wrapper to ensure fresh component instance per refresh
function EmailTableWrapper({
  status,
  onEdit,
}: {
  status: 'scheduled' | 'sent';
  onEdit?: (email: EmailRow) => void;
}) {
  return <EmailTable status={status} onEdit={onEdit} />;
}
