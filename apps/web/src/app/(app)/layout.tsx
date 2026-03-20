import { ApplicationLayout } from '@/components/application-layout';
import { QueryProvider } from '@/lib/query-client';
import { TooltipProvider } from '@zuko/ui-kit';


export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <TooltipProvider>
        <ApplicationLayout>{children}</ApplicationLayout>
      </TooltipProvider>
    </QueryProvider>
  );
}
