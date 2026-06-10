'use client';

import type {ReactNode} from 'react';
import {AuthGuard} from '@/components/auth-guard';
import AppSidebar from '@/components/shadcn-space/blocks/dashboard-shell-01/app-sidebar';

/**
 * Persistent dashboard chrome. The sidebar + header stay mounted while the
 * body content area (`children`) swaps between the Overview, Feeds and
 * Settings views via nested routes.
 */
export default function DashboardLayout({children}: {children: ReactNode}) {
  return (
    <AuthGuard mode="auth">
      <AppSidebar>{children}</AppSidebar>
    </AuthGuard>
  );
}
