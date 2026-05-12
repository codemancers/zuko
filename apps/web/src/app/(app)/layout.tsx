import { ApplicationLayout } from '@/components/application-layout';
import { QueryProvider } from '@/lib/query-client';
import { TooltipProvider } from '@zuko/ui-kit';
import { meetingsFlag } from '@/lib/flags';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showMeetings = await meetingsFlag();

  return (
    <QueryProvider>
      <TooltipProvider>
        <ApplicationLayout showMeetings={showMeetings}>
          {children}
        </ApplicationLayout>
      </TooltipProvider>
    </QueryProvider>
  );
}
