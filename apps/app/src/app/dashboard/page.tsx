'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from '../../lib/auth-client';

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <main style={{ margin: '4rem auto', maxWidth: 360 }}>Loading…</main>;
  }

  if (!session) {
    return (
      <main style={{ margin: '4rem auto', maxWidth: 360 }}>
        <h1>Not signed in</h1>
        <p>
          <Link href="/login">Log in</Link> or <Link href="/signup">sign up</Link>.
        </p>
      </main>
    );
  }

  return (
    <main style={{ margin: '4rem auto', maxWidth: 360 }}>
      <h1>Dashboard</h1>
      <p>
        Signed in as <strong>{session.user.name}</strong> ({session.user.email})
      </p>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.push('/login');
        }}
      >
        Sign out
      </button>
    </main>
  );
}
