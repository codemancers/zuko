import { OrgTeams } from '@/components/organization/org-teams';

export default async function OrganizationTeamsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  return <OrgTeams slug={resolvedParams.slug} />;
}
