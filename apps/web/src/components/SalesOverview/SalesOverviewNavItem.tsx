'use client';
import { SidebarNavItem } from '@zuko/ui-kit';
import { ChartBarIcon } from '@heroicons/react/20/solid';
import { useSalesOverviewAccess } from '@/hooks/use-sales-overview-access';

export function SalesOverviewNavItem({
  collapsed,
  current,
}: {
  collapsed: boolean;
  current: boolean;
}) {
  const { allowed } = useSalesOverviewAccess();
  if (!allowed) return null;
  return (
    <SidebarNavItem
      href="/sales-overview"
      label="Sales Overview"
      icon={ChartBarIcon}
      collapsed={collapsed}
      current={current}
    />
  );
}
