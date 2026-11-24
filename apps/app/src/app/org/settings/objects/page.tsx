'use client';

import { Suspense } from 'react';
import { ObjectsSheet } from '@/components/org/objects-sheet';

export default function OrgObjectsPage() {
  // useSearchParams (the open drawers) needs a Suspense boundary.
  return (
    <Suspense>
      <ObjectsSheet />
    </Suspense>
  );
}
