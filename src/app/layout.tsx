import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';
import { AppThemeProvider } from '@/theme/AppThemeProvider';

export const metadata: Metadata = {
  title: 'Unrestricted AI',
  description: 'Local-first personal AI assistant',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
