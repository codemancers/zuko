import { redirect } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { EmptyState } from '@/components/shared';
import { SalesOverview } from '@/components/SalesOverview/SalesOverview';

export const metadata = { title: 'Sales Overview' };
export const dynamic = 'force-dynamic';

export default async function SalesOverviewPage() {
  let access: { organizationId: number };
  try {
    access = await apiClient.get<{ organizationId: number }>(
      '/sales-overview/access',
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/sign-in');
    if (error instanceof ApiError && error.status === 403) {
      return (
        <EmptyState
          title="Sales Overview is restricted"
          description="Only Owners and Admins of the selected organization can open this page."
        />
      );
    }
    return (
      <EmptyState
        title="Unable to verify access"
        description="The server could not confirm your access. Refresh the page to try again."
      />
    );
  }
  return <SalesOverview organizationId={access.organizationId} />;
}
