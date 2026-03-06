import '@zuko/ui-kit/globals.css';
import { ThemeProvider } from '../components/theme-provider';
import { QueryProvider } from '../lib/react-query/query-provider';
import { ProgressBar } from '../components/progress-bar';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Toaster } from 'sonner';

export const metadata = {
  title: {
    template: '%s - Zuko',
    default: 'Zuko - Sell faster',
  },
  description: 'Zuko helps you sell faster with AI-powered assistance',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ProgressBar>
            <NuqsAdapter>
              <QueryProvider>{children}</QueryProvider>
            </NuqsAdapter>
            <Toaster richColors position="top-right" />
          </ProgressBar>
        </ThemeProvider>
      </body>
    </html>
  );
}
