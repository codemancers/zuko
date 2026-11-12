'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authClient, signOut, useSession } from '@/lib/auth-client';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateOrgForm() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const { data: orgs } = authClient.useListOrganizations();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!sessionPending && !session) router.replace('/login');
  }, [sessionPending, session, router]);

  // Only offer a way back once the user has somewhere to go back to.
  const hasOrgs = (orgs?.length ?? 0) > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    const base = slugify(trimmed);
    if (!base) {
      setError('Enter a name with at least one letter or number.');
      return;
    }
    setPending(true);
    setError(null);
    // Ask better-auth whether the slug is free; fall back to a suffixed one if not.
    let slug = base;
    const check = await authClient.organization.checkSlug({ slug });
    if (check.error) slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error: err } = await authClient.organization.create({ name: trimmed, slug });
    if (data) {
      router.push('/dashboard'); // create() also makes the new org active.
      return;
    }
    setError(err?.message ?? 'Could not create the organization.');
    setPending(false);
  }

  return (
    <Card>
      <form onSubmit={submit}>
        <CardHeader>
          <h1 className="font-heading text-xl font-medium">Create your organization</h1>
          <CardDescription>
            Organizations group your people and data. You can invite others later.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-4">
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc"
                autoFocus
                required
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button type="submit" className="w-full" disabled={pending || !session}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Create organization
          </Button>
          {hasOrgs ? (
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard">Cancel</Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={async () => {
                await signOut();
                router.push('/login');
              }}
            >
              Sign out
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
