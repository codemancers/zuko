'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout, Text } from '@zuko/ui-kit';
import { authClient } from '@/lib/auth-client';

/**
 * Where better-auth lands every successful login, via `callbackURL`.
 *
 * The destination depends on a lookup that can only run once a session
 * exists — members go to the app, invitees to their invitations, and everyone
 * else has to create an organization first — so it cannot be expressed as a
 * static callbackURL. Doing it on a route of its own instead of in the
 * sign-in handler keeps it out of the response cycle: when an MCP client has
 * an authorization in flight, oauthProvider rewrites the sign-in response to
 * point at the consent screen and the browser never reaches this page at all.
 */
export default function PostLoginPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const route = async () => {
      const { data: organizations } = await authClient.organization.list();
      if (cancelled) return;

      if (organizations && organizations.length > 0) {
        router.replace('/chat');
        return;
      }

      // Retry a few times to handle session propagation timing for new accounts
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
        const { data: invitations } =
          await authClient.organization.listUserInvitations();
        if (cancelled) return;

        if (invitations && invitations.length > 0) {
          router.replace('/settings?tab=invitations');
          return;
        }
      }

      router.replace('/organization/create');
    };

    void route();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <AuthLayout>
      <div className="grid w-full max-w-sm grid-cols-1 gap-8">
        <Text className="text-center">Signing you in…</Text>
      </div>
    </AuthLayout>
  );
}
