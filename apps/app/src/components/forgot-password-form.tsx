'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { requestPasswordReset } from '@/lib/auth-client';

type FormState = { error: string | null; email: string; sent: boolean };
const initialState: FormState = { error: null, email: '', sent: false };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (_previous: FormState, formData: FormData): Promise<FormState> => {
      const email = String(formData.get('email') ?? '');
      const { error } = await requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error)
        return { error: 'Unable to send the reset email. Please try again.', email, sent: false };
      return { error: null, email, sent: true };
    },
    initialState,
  );

  return (
    <Card>
      <CardHeader className="text-center">
        <h1 className="font-heading text-xl font-medium">Reset your password</h1>
        <CardDescription>Enter your email and we will send you a reset link.</CardDescription>
      </CardHeader>
      {state.sent ? (
        <CardContent className="text-center text-sm text-muted-foreground">
          If an account exists for <strong className="text-foreground">{state.email}</strong>, you
          will receive an email with instructions shortly.
        </CardContent>
      ) : (
        <form action={formAction}>
          <CardContent>
            <FieldGroup>
              {state.error && (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden />
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={state.email}
                  required
                />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending && (
                  <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
                )}
                Send reset link
              </Button>
            </FieldGroup>
          </CardContent>
        </form>
      )}
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to log in
        </Link>
      </CardFooter>
    </Card>
  );
}
