'use client';

import { Suspense } from 'react';
import { MembersSheet } from '@/components/org/members-sheet';
import { useOrgSettings } from '@/components/org/settings-context';

export default function OrgMembersPage() {
  const { org, userId, role } = useOrgSettings();
  // useSearchParams (sorting) needs a Suspense boundary.
  return (
    <Suspense>
      <MembersSheet org={org} myUserId={userId} myRole={role} />
    </Suspense>
  );
}
