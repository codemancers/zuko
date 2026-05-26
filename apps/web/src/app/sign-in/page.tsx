import { EmailPasswordAuth } from '@/components/auth/email-password-auth';
import { emailPasswordAuthFlag } from '@/lib/flags';

export const metadata = {
  title: 'Sign In',
};

const SignInPage = async () => {
  const emailPasswordEnabled = await emailPasswordAuthFlag();
  return (
    <EmailPasswordAuth
      mode="signin"
      emailPasswordEnabled={emailPasswordEnabled}
    />
  );
};

export default SignInPage;
