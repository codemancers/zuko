import { OrgAdmins } from '@/components/organization/org-admins';

export default async function OrganizationAdminsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  return <OrgAdmins slug={resolvedParams.slug} />;
}
