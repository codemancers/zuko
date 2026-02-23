import { EmailPasswordAuth } from '@/components/auth/email-password-auth';

export const metadata = {
  title: 'Sign In',
};

const SignInPage = () => {
  return <EmailPasswordAuth mode="signin" />;
};

export default SignInPage;
