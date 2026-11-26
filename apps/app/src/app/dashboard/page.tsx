'use client';

import Link from 'next/link';
import { ArrowUpRight, PlugZap, Settings } from 'lucide-react';
import { getObjectIcon } from '@/components/records/object-icons';
import { Shell } from '@/components/dashboard/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';

const records = [
  {
    href: '/records/contact',
    title: 'Contacts',
    description: 'The people you work with.',
    icon: getObjectIcon('contact'),
  },
  {
    href: '/records/company',
    title: 'Companies',
    description: 'Organizations and their relationships.',
    icon: getObjectIcon('company'),
  },
  {
    href: '/records/deal',
    title: 'Deals',
    description: 'Opportunities and what comes next.',
    icon: getObjectIcon('deal'),
  },
  {
    href: '/records/prospect',
    title: 'Prospects',
    description: 'People you plan to reach.',
    icon: getObjectIcon('prospect'),
  },
  {
    href: '/records/lead',
    title: 'Leads',
    description: 'People who have shown interest.',
    icon: getObjectIcon('lead'),
  },
];

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  if (isPending)
    return (
      <Shell>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-52" />
      </Shell>
    );
  if (!session)
    return (
      <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <h1 className="text-2xl font-semibold tracking-tight">Not signed in</h1>
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
  const firstName = session.user.name.trim().split(/\s+/)[0] || session.user.name;
  return (
    <Shell>
      <div className="pb-2">
        <p className="mb-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Your workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Pick up with your records, or make this workspace your own.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your records</CardTitle>
          <CardDescription>People, companies, and opportunities. Connected.</CardDescription>
        </CardHeader>
        <CardContent>
          <nav aria-label="Record workspaces" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {records.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-xl border bg-background/50 p-5 transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="mb-5 flex items-center justify-between">
                  <Icon className="size-5 text-muted-foreground" aria-hidden />
                  <ArrowUpRight
                    className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
                    aria-hidden
                  />
                </span>
                <span className="block font-medium">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {description}
                </span>
              </Link>
            ))}
          </nav>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            href: '/org/settings/details',
            title: 'Make it your workspace',
            description: 'Manage your team, objects, and permissions.',
            icon: Settings,
          },
          {
            href: '/account/connections',
            title: 'Connect your tools',
            description: 'Review the apps that can work on your behalf.',
            icon: PlugZap,
          },
        ].map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-4 rounded-xl border bg-card/50 p-5 transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="block text-sm font-medium">{title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
