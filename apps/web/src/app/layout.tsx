import '@zuko/ui-kit/globals.css';
import { ThemeProvider } from '../components/theme-provider';
import { QueryProvider } from '../lib/react-query/query-provider';
import { ProgressBar } from '../components/progress-bar';

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
            <QueryProvider>{children}</QueryProvider>
          </ProgressBar>
        </ThemeProvider>
      </body>
    </html>
  );
}
