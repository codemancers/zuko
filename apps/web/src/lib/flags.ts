import { flag } from 'flags/next';

export const meetingsFlag = flag<boolean>({
  key: 'meetings',
  async decide() {
    return process.env.MEETINGS_ENABLED === 'true';
  },
  description: 'Enable the Meetings feature',
  defaultValue: false,
  options: [
    { value: false, label: 'Disabled' },
    { value: true, label: 'Enabled' },
  ],
});

export const emailPasswordAuthFlag = flag<boolean>({
  key: 'email-password-auth',
  async decide() {
    return process.env.NEXT_PUBLIC_BETTER_AUTH_INCLUDE_EMAILS_AUTH === 'true';
  },
  description: 'Enable email/password login and signup',
  defaultValue: false,
  options: [
    { value: false, label: 'Disabled' },
    { value: true, label: 'Enabled' },
  ],
});
