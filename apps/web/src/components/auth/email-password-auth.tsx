'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout, Button, Field, Label, Input } from '@zuko/ui-kit';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';

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

  /** Shared post-auth redirect: org → chat, invitations → settings, else → create org */
  const redirectAfterAuth = async () => {
    const { data } = await authClient.organization.list();
    if (data && data.length > 0) {
      router.push('/chat');
    } else {
      const { data: invitations } =
        await authClient.organization.listUserInvitations();
      if (invitations && invitations.length > 0) {
        router.push('/settings?tab=invitations');
      } else {
        router.push('/organization/create');
      }
    }
  };

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
          await redirectAfterAuth();
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
          await redirectAfterAuth();
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Email/password auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    authClient.signIn.social({
      provider: 'google',
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

        {/* Google OAuth button */}
        <div className="flex justify-center">
          <Button
            type="button"
            onClick={handleGoogleSignIn}
            outline
            className="flex gap-2 items-center"
          >
            <Image
              src="/icons/google.svg"
              alt="Google"
              width={20}
              height={20}
            />
            Continue with Google
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
                  <Link
                    href="/sign-in"
                    className="font-semibold text-zinc-950 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-300"
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{' '}
                  <Link
                    href="/sign-up"
                    className="font-semibold text-zinc-950 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-300"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
