'use client';

import { DetailsPanel } from '@/components/org/details-panel';
import { useOrgSettings } from '@/components/org/settings-context';
import { authClient } from '@/lib/auth-client';

export default function OrgDetailsPage() {
  const { org, role } = useOrgSettings();
  // better-auth's permission helper, rather than matching role names by hand.
  const canEdit =
    !!role &&
    authClient.organization.checkRolePermission({
      role: role as 'member',
      permissions: { organization: ['update'] },
    });

  return (
    <div className="p-6">
      {/* Keyed so switching orgs resets any edit in progress. */}
      <DetailsPanel key={org.id} org={org} role={role} canEdit={canEdit} />
    </div>
  );
}
