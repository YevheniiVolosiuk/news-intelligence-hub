import './globals.css';
import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {AuthProvider} from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'News Intelligence Hub',
  description:
    'Aggregates RSS into a per-user graph of articles, entities, and relationships.',
};

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
