import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Chat',
};

// Server Component layout guard - performs real session validation
async function getSession() {
  try {
    const headersList = await headers();
    // Use backend URL from environment, fallback to localhost for development
    // Use NEXT_PUBLIC_BACKEND_URL for client-side consistency
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/auth/get-session`, {
      headers: Object.fromEntries(headersList.entries()),
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.session || null;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
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

  return <>{children}</>;
}
