import { EmailPasswordAuth } from '@/components/auth/email-password-auth';
import { emailPasswordAuthFlag } from '@/lib/flags';

export const metadata = {
  title: 'Sign Up',
};

const SignUpPage = async () => {
  const emailPasswordEnabled = await emailPasswordAuthFlag();
  return (
    <EmailPasswordAuth
      mode="signup"
      emailPasswordEnabled={emailPasswordEnabled}
    />
  );
};

export default SignUpPage;
