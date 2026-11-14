import { ResetPasswordForm } from '@/components/reset-password-form';
import { Suspense } from 'react';

export const metadata = { title: 'Set a new password' };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
