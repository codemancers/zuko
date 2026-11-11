'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { signIn, signUp } from '../../lib/auth-client';

type Mode = 'login' | 'signup';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignup = mode === 'signup';

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));

    const { error } = isSignup
      ? await signUp.email({ email, password, name: String(form.get('name')) })
      : await signIn.email({ email, password });

    setPending(false);
    if (error) {
      setError(error.message ?? 'Something went wrong');
      return;
    }
    router.push('/dashboard');
  }

  return (
    <main style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>{isSignup ? 'Create an account' : 'Log in'}</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        {isSignup && (
          <label htmlFor="name">
            Name
            <input id="name" name="name" type="text" autoComplete="name" required />
          </label>
        )}
        <label htmlFor="email">
          Email
          <input id="email" name="email" type="email" autoComplete="email" required />
        </label>
        <label htmlFor="password">
          Password
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
        </button>
      </form>
      <p>
        {isSignup ? (
          <>
            Already have an account? <Link href="/login">Log in</Link>
          </>
        ) : (
          <>
            No account yet? <Link href="/signup">Sign up</Link>
          </>
        )}
      </p>
    </main>
  );
}
