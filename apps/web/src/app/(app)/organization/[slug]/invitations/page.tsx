import { OrgInvitations } from '@/components/organization/org-invitations';

export default async function OrganizationInvitationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  return <OrgInvitations slug={resolvedParams.slug} />;
}
