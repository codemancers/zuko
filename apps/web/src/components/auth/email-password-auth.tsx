'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout, Button, Field, Label, Input } from '@zuko/ui-kit';
import { authClient } from '@/lib/auth-client';

interface EmailPasswordAuthProps {
  mode?: 'signin' | 'signup';
}

const includeEmailAuth =
  process.env.NEXT_PUBLIC_BETTER_AUTH_INCLUDE_EMAILS_AUTH === 'true';

export function EmailPasswordAuth({ mode = 'signin' }: EmailPasswordAuthProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Email/Password form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const isSignup = mode === 'signup';

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isSignup) {
        const result = await authClient.signUp.email({
          email,
          password,
          name,
        });

        if (result.error) {
          setError(
            result.error.message ||
              'Failed to create account. Please try again.',
          );
        } else {
          router.push('/chat');
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });

        if (result.error) {
          setError(
            result.error.message ||
              'Failed to sign in. Please check your credentials.',
          );
        } else {
          router.push('/chat');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Email/password auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubSignIn = () => {
    authClient.signIn.social({
      provider: 'github',
      callbackURL: `${window.location.origin}/chat`,
    });
  };

  return (
    <AuthLayout>
      <div className="grid w-full max-w-sm grid-cols-1 gap-8">
        <div>
          <h1 className="text-center text-2xl font-semibold">
            {isSignup ? 'Create your account' : 'Sign in to Zuko'}
          </h1>
          <div className="mt-4 border-t border-zinc-200 dark:border-zinc-700" />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/50 dark:text-red-200">
            {error}
          </div>
        )}

        {/* GitHub OAuth button */}
        <div className="flex justify-center">
          <Button type="button" onClick={handleGitHubSignIn} outline>
            <svg data-slot="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </Button>
        </div>

        {includeEmailAuth && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleEmailPasswordSubmit} className="grid gap-6">
              {isSignup && (
                <Field>
                  <Label>Full name</Label>
                  <Input
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="name"
                  />
                </Field>
              )}

              <Field>
                <Label>Email</Label>
                <Input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </Field>

              <Field>
                <Label>Password</Label>
                <Input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  minLength={8}
                />
              </Field>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? isSignup
                    ? 'Creating account...'
                    : 'Signing in...'
                  : isSignup
                    ? 'Create account'
                    : 'Sign in'}
              </Button>
            </form>

            <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              {isSignup ? (
                <>
                  Already have an account?{' '}
                  <a
                    href="/sign-in"
                    className="font-semibold text-zinc-950 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-300"
                  >
                    Sign in
                  </a>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{' '}
                  <a
                    href="/sign-up"
                    className="font-semibold text-zinc-950 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-300"
                  >
                    Sign up
                  </a>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
