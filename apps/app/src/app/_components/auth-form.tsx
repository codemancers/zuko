'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { signIn, signUp } from '../../lib/auth-client';

type Mode = 'login' | 'signup';

// Kept in state so a failed submit doesn't clear what the user typed: React 19
// resets uncontrolled inputs once a form action finishes.
type FormState = { error: string | null; name: string; email: string };

const initialState: FormState = { error: null, name: '', email: '' };

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isSignup = mode === 'signup';

  const [state, formAction, pending] = useActionState(
    async (_previous: FormState, formData: FormData): Promise<FormState> => {
      const name = String(formData.get('name') ?? '');
      const email = String(formData.get('email'));
      const password = String(formData.get('password'));

      const { error } = isSignup
        ? await signUp.email({ email, password, name })
        : await signIn.email({ email, password });

      if (error) {
        return { error: error.message ?? 'Something went wrong', name, email };
      }
      router.push('/dashboard');
      return { error: null, name, email };
    },
    initialState,
  );

  return (
    <main style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>{isSignup ? 'Create an account' : 'Log in'}</h1>
      <form action={formAction} style={{ display: 'grid', gap: '0.75rem' }}>
        {isSignup && (
          <label htmlFor="name">
            Name
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              defaultValue={state.name}
              required
            />
          </label>
        )}
        <label htmlFor="email">
          Email
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            required
          />
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
        {state.error && <p role="alert">{state.error}</p>}
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
