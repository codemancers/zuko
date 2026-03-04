import { OrgMembers } from '@/components/organization/org-members';

export default async function OrganizationMembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  return <OrgMembers slug={resolvedParams.slug} />;
}
