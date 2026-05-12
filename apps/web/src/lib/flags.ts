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
