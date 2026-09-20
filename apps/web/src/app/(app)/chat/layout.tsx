import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Chat',
};

// Use backend URL from environment, fallback to localhost for development
// Use NEXT_PUBLIC_BACKEND_URL for client-side consistency
const backendUrl = () =>
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:3001';

async function authFetch(path: string) {
  const headersList = await headers();
  const response = await fetch(`${backendUrl()}${path}`, {
    headers: Object.fromEntries(headersList.entries()),
    cache: 'no-store',
  });

  return response.ok ? await response.json() : null;
}

// Server Component layout guard - performs real session validation
async function getSession() {
  try {
    const data = await authFetch('/auth/get-session');
    return data?.session || null;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * Where to send someone who reaches the app without an organization.
 *
 * activeOrganizationId is stamped on the session when it is created
 * (databaseHooks.session.create.before in the backend's better-auth config)
 * and refreshed by setActive when an organization is created or an invitation
 * accepted. So its absence is a dependable "no organization yet", and it
 * flips the moment they have one — which is what stops this bouncing them
 * straight back here.
 */
async function organizationlessDestination() {
  // Retry a few times to handle session propagation timing for new accounts
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500));

    try {
      const invitations = await authFetch(
        '/auth/organization/list-user-invitations',
      );
      if (Array.isArray(invitations) && invitations.length > 0) {
        return '/settings?tab=invitations';
      }
    } catch (error) {
      console.error('Failed to list invitations:', error);
    }
  }

  return '/organization/create';
}

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Real server-side session validation
  const session = await getSession();

  if (!session) {
    redirect('/sign-in');
  }

  // better-auth can only redirect to a fixed callbackURL, but where a login
  // belongs depends on state that exists only once there is a session. So
  // every login lands here and the decision is made at the door. This also
  // catches anyone navigating straight to /chat without an organization, who
  // previously reached an app where every request failed with
  // NO_ACTIVE_ORGANIZATION.
  if (!session.activeOrganizationId) {
    redirect(await organizationlessDestination());
  }

  return <>{children}</>;
}
