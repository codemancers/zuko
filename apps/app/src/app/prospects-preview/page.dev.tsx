import type { Metadata } from 'next';
import { Brand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProspectsPreview } from '@/components/prospects/prospects-preview';

export const metadata: Metadata = {
  title: 'Prospects preview',
  description: 'Development-only prospect UI preview. No records are saved.',
};

export default function ProspectsPreviewPage() {
  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Brand />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ProspectsPreview />
      </main>
    </div>
  );
}
