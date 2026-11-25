'use client';

import { Suspense } from 'react';
import { ObjectsSheet } from '@/components/organizations/objects-sheet';

export default function OrgObjectsPage() {
  // useSearchParams (the open drawers) needs a Suspense boundary.
  return (
    <Suspense>
      <ObjectsSheet />
    </Suspense>
  );
}
