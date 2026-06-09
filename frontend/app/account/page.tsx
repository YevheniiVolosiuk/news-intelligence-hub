'use client';

import {useAuth} from '@/lib/auth-context';
import {AuthGuard} from '@/components/auth-guard';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Separator} from '@/components/ui/separator';

export default function AccountPage() {
  const {user, logout} = useAuth();

  return (
    <AuthGuard mode="auth">
      <section className="bg-foreground dark:bg-background relative flex min-h-screen items-center justify-center">
        <div className="pointer-events-none absolute inset-0 right-0 hidden overflow-hidden md:block">
          <div className="absolute left-1/1 top-0 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10" />
          <div className="bg-foreground dark:bg-background absolute left-1/1 top-0 h-[175px] w-[175px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </div>

        <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-0 md:py-20">
          <Card className="relative max-w-lg px-6 py-8 sm:p-12">
            <CardHeader className="gap-6 p-0 text-center">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-card-foreground text-2xl font-medium">
                  Your Account
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm font-normal">
                  Manage your profile and session.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="flex flex-col gap-5 pt-2">
                <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
                  <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Email
                  </span>
                  <p className="text-card-foreground text-sm font-medium">
                    {user?.email}
                  </p>
                </div>
                <Separator />
                <Button
                  onClick={() => void logout()}
                  variant="outline"
                  size="lg"
                  className="h-10 rounded-lg"
                >
                  Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </AuthGuard>
  );
}
