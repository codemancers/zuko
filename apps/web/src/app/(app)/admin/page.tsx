import { Heading, Text } from '@zuko/ui-kit';
import { RoleGuard } from '@/components/role-guard';

export default function AdminPage() {
  return (
    <RoleGuard
      role="admin"
      fallback={
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-center">
            <Heading>Access Denied</Heading>
            <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
              You need admin privileges to view this page.
            </Text>
          </div>
        </div>
      }
    >
      <Heading>Admin Dashboard</Heading>
      <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome to the admin area. Only users with the 'admin' role can see
        this.
      </Text>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <h3 className="text-base/6 font-semibold">User Management</h3>
          <p className="mt-2 text-sm/6 text-zinc-600 dark:text-zinc-400">
            Manage user accounts and permissions
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <h3 className="text-base/6 font-semibold">System Settings</h3>
          <p className="mt-2 text-sm/6 text-zinc-600 dark:text-zinc-400">
            Configure application settings
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <h3 className="text-base/6 font-semibold">Analytics</h3>
          <p className="mt-2 text-sm/6 text-zinc-600 dark:text-zinc-400">
            View system analytics and reports
          </p>
        </div>
      </div>
    </RoleGuard>
  );
}
