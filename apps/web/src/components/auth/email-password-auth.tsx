'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout, Button, Field, Label, Input } from '@zuko/ui-kit';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';

interface EmailPasswordAuthProps {
  mode?: 'signin' | 'signup';
  emailPasswordEnabled?: boolean;
}

export function EmailPasswordAuth({
  mode = 'signin',
  emailPasswordEnabled = false,
}: EmailPasswordAuthProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Email/Password form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const isSignup = mode === 'signup';

  // A signed authorization query lands on whichever of /sign-in or /sign-up
  // oauthProvider sent the user to. The cross-link between the two pages has
  // to carry it, or a user who signs up mid-authorization arrives with no
  // query for the client plugin to attach and the MCP client is left waiting.
  // Read after mount so the server render and first client render agree.
  const [authQuery, setAuthQuery] = useState('');
  useEffect(() => setAuthQuery(window.location.search), []);

  /** Where better-auth sends every successful login; see app/post-login. */
  const postLoginURL = () => `${window.location.origin}/post-login`;

  /**
   * better-auth's redirectPlugin (client/fetch-plugins.mjs) navigates by
   * itself whenever a response comes back as { redirect, url } — which is
   * both how `callbackURL` is honoured and how oauthProvider hands back the
   * consent screen after resuming an MCP authorization.
   *
   * signUp.email is the one endpoint that never sets those fields: it returns
   * { token, user } and uses callbackURL only for the verification link
   * (api/routes/sign-up.mjs). So that branch still has to navigate on its
   * own, and has to check first or it races the plugin.
   */
  const pluginWillRedirect = (data: unknown) =>
    Boolean((data as { redirect?: boolean } | null)?.redirect);

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Set once we hand off to a full-page navigation; the button must stay
    // disabled for the round trip rather than flicking back to enabled.
    let leaving = false;

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
          leaving = true;
          if (!pluginWillRedirect(result.data)) router.push('/post-login');
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: postLoginURL(),
        });

        if (result.error) {
          setError(
            result.error.message ||
              'Failed to sign in. Please check your credentials.',
          );
        } else {
          leaving = true;
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Email/password auth error:', err);
    } finally {
      if (!leaving) setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    authClient.signIn.social({
      provider: 'google',
      callbackURL: postLoginURL(),
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

        {emailPasswordEnabled && (
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
                    href={`/sign-in${authQuery}`}
                    className="font-semibold text-zinc-950 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-300"
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{' '}
                  <Link
                    href={`/sign-up${authQuery}`}
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
