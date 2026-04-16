import { Heading, Text, Divider } from '@zuko/ui-kit';
import { RoleGuard } from '@/components/role-guard';
import {
  Cog6ToothIcon,
  ChartBarIcon,
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
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-center">
            <Heading>Access Denied</Heading>
            <Text className="mt-2">
              You need admin privileges to view this page.
            </Text>
          </div>
        </div>
      }
    >
      <Heading>Admin Dashboard</Heading>
      <Text className="mt-2">
        Welcome to the admin area. Only admins and owners can see this.
      </Text>

      <Divider className="my-8" />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_CARDS.map(({ title, description, icon: Icon }) => (
          <div
            key={title}
            className="rounded-xl border border-zinc-950/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900"
          >
            <Icon className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
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
