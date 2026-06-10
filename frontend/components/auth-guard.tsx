'use client';

import {useAuth} from '@/lib/auth-context';
import {useRouter} from 'next/navigation';
import type {ReactNode} from 'react';

interface AuthGuardProps {
  mode: 'auth' | 'guest';
  children: ReactNode;
}

export function AuthGuard({mode, children}: AuthGuardProps) {
  const {user, loading} = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-muted-foreground h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (mode === 'auth' && !user) {
    router.replace('/login');
    return null;
  }

  if (mode === 'guest' && user) {
    router.replace('/dashboard');
    return null;
  }

  return <>{children}</>;
}
