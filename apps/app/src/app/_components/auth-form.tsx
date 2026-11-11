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
    <main className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="mb-4 text-2xl font-semibold">{isSignup ? 'Create an account' : 'Log in'}</h1>
      <form action={formAction} className="grid gap-3">
        {isSignup && (
          <label className="grid gap-1 text-sm font-medium" htmlFor="name">
            Name
            <input
              className="rounded border border-gray-300 px-3 py-2 text-base font-normal"
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              defaultValue={state.name}
              required
            />
          </label>
        )}
        <label className="grid gap-1 text-sm font-medium" htmlFor="email">
          Email
          <input
            className="rounded border border-gray-300 px-3 py-2 text-base font-normal"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-medium" htmlFor="password">
          Password
          <input
            className="rounded border border-gray-300 px-3 py-2 text-base font-normal"
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        {isSignup ? (
          <>
            Already have an account?{' '}
            <Link className="underline" href="/login">
              Log in
            </Link>
          </>
        ) : (
          <>
            No account yet?{' '}
            <Link className="underline" href="/signup">
              Sign up
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
