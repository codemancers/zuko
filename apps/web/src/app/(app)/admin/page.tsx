import { Heading, Text } from '@zuko/ui-kit';
import { EmptyState, PageHeader } from '@/components/shared';
import { RoleGuard } from '@/components/role-guard';
import {
  ChartBarIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

const ADMIN_CARDS = [
  {
    title: 'User Management',
    description: 'Manage user accounts and permissions',
    icon: UsersIcon,
  },
  {
    title: 'System Settings',
    description: 'Configure application settings',
    icon: Cog6ToothIcon,
  },
  {
    title: 'Analytics',
    description: 'View system analytics and reports',
    icon: ChartBarIcon,
  },
];

export default function AdminPage() {
  return (
    <RoleGuard
      role={['admin', 'owner']}
      fallback={
        <EmptyState
          icon={LockClosedIcon}
          title="Access denied"
          description="You need admin privileges to view this page."
        />
      }
    >
      <PageHeader
        title="Admin Dashboard"
        description="Welcome to the admin area. Only admins and owners can see this."
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_CARDS.map(({ title, description, icon: Icon }) => (
          <div
            key={title}
            className="rounded-xl bg-white p-6 shadow-border transition-[box-shadow] duration-150 ease-out hover:shadow-border-hover dark:bg-zinc-900"
          >
            <Icon className="size-6 text-zinc-500 dark:text-zinc-400" />
            <Heading level={3} className="mt-4">
              {title}
            </Heading>
            <Text className="mt-1">{description}</Text>
          </div>
        ))}
      </div>
    </RoleGuard>
  );
}
