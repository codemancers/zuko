'use client';

import { createContext, useContext } from 'react';
import type { authClient } from '@/lib/auth-client';

export type Org = NonNullable<ReturnType<typeof authClient.useActiveOrganization>['data']>;

export type OrgSettings = { org: Org; userId: string; role: string };

const OrgSettingsContext = createContext<OrgSettings | null>(null);

export const OrgSettingsProvider = OrgSettingsContext.Provider;

/** The signed-in user's active organization and role; only valid under the settings layout. */
export function useOrgSettings(): OrgSettings {
  const value = useContext(OrgSettingsContext);
  if (!value) throw new Error('useOrgSettings must be used inside the org settings layout');
  return value;
}
