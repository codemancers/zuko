'use client';

import { Suspense } from 'react';
import { IntegrationsSheet } from '@/components/integrations/integrations-sheet';

export default function OrgIntegrationsPage() {
  // useSearchParams (the open drawer) needs a Suspense boundary.
  return (
    <Suspense>
      <IntegrationsSheet />
    </Suspense>
  );
}
