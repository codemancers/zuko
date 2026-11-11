'use client';

import Link from 'next/link';
import { BellRing, Clock } from 'lucide-react';
import { Brand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/dashboard/user-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';

function Shell({ children, menu }: { children: React.ReactNode; menu: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Brand />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {menu}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">{children}</main>
    </div>
  );
}

function EmptyCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Clock;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <Shell menu={<Skeleton className="size-8 rounded-full" />}>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </Shell>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <h1 className="font-heading text-xl font-medium">Not signed in</h1>
            <CardDescription>Log in to see your dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-2">
            <Button asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/signup">Sign up</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { name, email, emailVerified, image, createdAt } = session.user;
  const firstName = name.trim().split(/\s+/)[0] || name;

  return (
    <Shell menu={<UserMenu name={name} email={email} image={image} />}>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here is what is happening in your workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <CardDescription>The details you signed up with.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{name}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="flex flex-wrap items-center gap-2 font-medium">
                {email}
                <Badge variant={emailVerified ? 'secondary' : 'outline'}>
                  {emailVerified ? 'Verified' : 'Unverified'}
                </Badge>
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">
                {new Date(createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <EmptyCard
          title="Needs attention"
          description="Nothing needs your attention right now."
          icon={BellRing}
        />
        <EmptyCard
          title="Recent work"
          description="Your recent activity will show up here."
          icon={Clock}
        />
      </div>
    </Shell>
  );
}
