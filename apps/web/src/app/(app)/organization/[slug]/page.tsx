import { OrgManage } from '@/components/organization/org-manage';

export default async function ManageOrganizationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  return <OrgManage slug={resolvedParams.slug} />;
}
