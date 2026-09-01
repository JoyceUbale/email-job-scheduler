'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Inbox, LogOut, User as UserIcon, Mail, MessageSquare, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

export function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [slackConnecting, setSlackConnecting] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  function handleConnectSlack() {
    if (slackConnected) return;
    setSlackConnecting(true);
    // Simulated Slack OAuth flow
    setTimeout(() => {
      setSlackConnecting(false);
      setSlackConnected(true);
      toast.success('Slack workspace connected!', {
        description: 'You will receive notifications in Slack when emails are sent.',
      });
    }, 1500);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/70 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-2 shadow-md shadow-primary/20">
            <Inbox className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">ReachInbox</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Connect Slack button */}
          <Button
            onClick={handleConnectSlack}
            variant={slackConnected ? 'secondary' : 'outline'}
            size="sm"
            className="gap-2"
            disabled={slackConnecting}
          >
            {slackConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : slackConnected ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {slackConnecting
                ? 'Connecting...'
                : slackConnected
                  ? 'Slack Connected'
                  : 'Connect Slack'}
            </span>
            <span className="sm:hidden">
              {slackConnected ? 'Connected' : 'Slack'}
            </span>
          </Button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg p-1 pr-2 transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name || ''} />
                  <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left md:block">
                  <p className="text-sm font-medium leading-tight text-foreground">{user?.name}</p>
                  <p className="text-xs leading-tight text-muted-foreground">{user?.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name || ''} />
                      <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{user?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                <UserIcon className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
