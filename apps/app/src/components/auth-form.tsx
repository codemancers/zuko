'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { signIn, signUp } from '@/lib/auth-client';
import { safeNextPath } from '@/lib/safe-next';

type Mode = 'login' | 'signup';

// Kept in state so a failed submit doesn't clear what the user typed: React 19
// resets uncontrolled inputs once a form action finishes.
type FormState = { error: string | null; name: string; email: string };

const initialState: FormState = { error: null, name: '', email: '' };

const copy = {
  login: {
    title: 'Welcome back',
    description: 'Log in to your Zuko account.',
    submit: 'Log in',
    switchText: 'No account yet?',
    switchHref: '/signup',
    switchLink: 'Sign up',
  },
  signup: {
    title: 'Create your account',
    description: 'Get started with Zuko in a minute.',
    submit: 'Sign up',
    switchText: 'Already have an account?',
    switchHref: '/login',
    switchLink: 'Log in',
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isSignup = mode === 'signup';
  const text = copy[mode];
  const [showPassword, setShowPassword] = useState(false);

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
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(safeNextPath(next));
      return { error: null, name, email };
    },
    initialState,
  );

  return (
    <Card>
      <CardHeader className="text-center">
        <h1 className="font-heading text-xl font-medium">{text.title}</h1>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent>
          <FieldGroup>
            {state.error && (
              <Alert variant="destructive">
                <AlertCircle aria-hidden />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            {isSignup && (
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  defaultValue={state.name}
                  placeholder="Ada Lovelace"
                  required
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={state.email}
                placeholder="you@company.com"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className="pr-9"
                  minLength={8}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </div>
              {isSignup && <FieldDescription>Use at least 8 characters.</FieldDescription>}
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
              {text.submit}
            </Button>
            {!isSignup && (
              <Link
                href="/forgot-password"
                className="text-center text-sm underline-offset-4 hover:underline"
              >
                Forgot your password?
              </Link>
            )}
          </FieldGroup>
        </CardContent>
      </form>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        {text.switchText}
        <Link
          href={text.switchHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {text.switchLink}
        </Link>
      </CardFooter>
    </Card>
  );
}
