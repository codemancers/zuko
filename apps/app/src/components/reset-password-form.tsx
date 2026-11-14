'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { resetPassword } from '@/lib/auth-client';

type FormState = { error: string | null; complete: boolean };
const initialState: FormState = { error: null, complete: false };

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_previous: FormState, formData: FormData): Promise<FormState> => {
      const password = String(formData.get('password') ?? '');
      const confirmation = String(formData.get('confirmation') ?? '');
      if (!token) return { error: 'This reset link is invalid or has expired.', complete: false };
      if (password !== confirmation) return { error: 'Passwords do not match.', complete: false };
      const { error } = await resetPassword({ newPassword: password, token });
      return error
        ? {
            error: 'This reset link is invalid or has expired. Please request a new one.',
            complete: false,
          }
        : { error: null, complete: true };
    },
    initialState,
  );

  return (
    <Card>
      <CardHeader className="text-center">
        <h1 className="font-heading text-xl font-medium">Set a new password</h1>
        <CardDescription>
          {state.complete
            ? 'Your password has been updated.'
            : 'Choose a new password for your account.'}
        </CardDescription>
      </CardHeader>
      {state.complete ? (
        <CardFooter className="justify-center">
          <Link href="/login" className="font-medium underline-offset-4 hover:underline">
            Continue to log in
          </Link>
        </CardFooter>
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
                <FieldLabel htmlFor="password">New password</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    className="pr-9"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((shown) => !shown)}
                  >
                    {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                  </Button>
                </div>
                <FieldDescription>Use at least 8 characters.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmation">Confirm password</FieldLabel>
                <Input
                  id="confirmation"
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending && (
                  <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
                )}
                Set new password
              </Button>
            </FieldGroup>
          </CardContent>
        </form>
      )}
    </Card>
  );
}
