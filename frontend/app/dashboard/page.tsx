'use client';

import {useAuth} from '@/lib/auth-context';
import {PageBody} from '@/components/dashboard/page-body';
import DashboardOverview from '@/components/shadcn-space/blocks/dashboard-shell-01/page';

export default function DashboardPage() {
  const {user} = useAuth();
  const name = user?.email?.split('@')[0];

  return (
    <PageBody
      title={name ? `Welcome back, ${name}` : 'Dashboard'}
      description="Your sources at a glance."
    >
      <DashboardOverview />
    </PageBody>
  );
}
