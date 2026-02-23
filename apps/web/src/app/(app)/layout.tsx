import { ApplicationLayout } from '@/components/application-layout';
import { QueryProvider } from '@/lib/query-client';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ApplicationLayout>{children}</ApplicationLayout>
    </QueryProvider>
  );
}
