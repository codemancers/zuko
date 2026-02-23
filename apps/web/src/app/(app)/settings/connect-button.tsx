'use client';

import { authClient } from '@/lib/auth-client';
import { Button } from '@zuko/ui-kit';

type ConnectButtonProps = {
  provider: 'google' | 'github';
  disabled?: boolean;
};

const labels: Record<ConnectButtonProps['provider'], string> = {
  google: 'Connect',
  github: 'Connect',
};

const colors: Record<ConnectButtonProps['provider'], 'blue' | 'zinc'> = {
  google: 'blue',
  github: 'zinc',
};

export const ConnectButton = ({ provider, disabled }: ConnectButtonProps) => {
  const handleClick = async () => {
    await authClient.linkSocial({
      provider,
    });
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      color={colors[provider]}
    >
      {labels[provider]}
    </Button>
  );
};
