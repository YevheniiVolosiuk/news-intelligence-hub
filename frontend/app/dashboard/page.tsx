'use client';

import {AuthGuard} from '@/components/auth-guard';
import DashboardShell from '@/components/shadcn-space/blocks/dashboard-shell-01/page';

export default function DashboardPage() {
  return (
    <AuthGuard mode="auth">
      <DashboardShell />
    </AuthGuard>
  );
}
