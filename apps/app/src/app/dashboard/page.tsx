'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from '../../lib/auth-client';

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <main className="mx-auto mt-16 max-w-sm px-4">Loading…</main>;
  }

  if (!session) {
    return (
      <main className="mx-auto mt-16 max-w-sm px-4">
        <h1 className="mb-4 text-2xl font-semibold">Not signed in</h1>
        <p>
          <Link className="underline" href="/login">
            Log in
          </Link>{' '}
          or{' '}
          <Link className="underline" href="/signup">
            sign up
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="mb-4 text-2xl font-semibold">Dashboard</h1>
      <p>
        Signed in as <strong>{session.user.name}</strong> ({session.user.email})
      </p>
      <button
        type="button"
        className="mt-4 cursor-pointer rounded bg-black px-3 py-2 text-white"
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
