import { EmailPasswordAuth } from '@/components/auth/email-password-auth';

export const metadata = {
  title: 'Sign Up',
};

const SignUpPage = () => {
  return <EmailPasswordAuth mode="signup" />;
};

export default SignUpPage;
