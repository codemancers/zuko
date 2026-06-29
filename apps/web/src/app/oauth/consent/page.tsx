import { Metadata } from 'next';
import { Suspense } from 'react';
import { OAuthConsent } from '@/components/auth/oauth-consent';

export const metadata: Metadata = {
  title: 'Authorize application | GatherAI',
  description: 'Review the access an application is requesting',
};

export default function OAuthConsentPage() {
  return (
    <Suspense>
      <OAuthConsent />
    </Suspense>
  );
}
