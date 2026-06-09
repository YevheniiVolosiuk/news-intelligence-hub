'use client';

import {Suspense, useState, useEffect, type FormEvent} from 'react';
import {useSearchParams} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Field, FieldGroup, FieldLabel} from '@/components/ui/field';
import {Input} from '@/components/ui/input';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

type ConfirmOutcome =
  | 'loading'
  | 'confirmed'
  | 'already_used'
  | 'expired'
  | 'invalid'
  | 'error';

interface ConfirmState {
  outcome: ConfirmOutcome;
  email?: string;
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ConfirmPageInner />
    </Suspense>
  );
}

function ConfirmPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<ConfirmState>({outcome: 'loading'});
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Submit the token automatically on mount.
  useEffect(() => {
    if (!token) {
      setState({outcome: 'invalid'});
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/confirm`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({token}),
        });
        const body = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (res.ok) {
          setState({outcome: 'confirmed', email: body.email});
        } else if (res.status === 410) {
          const msg = String(body.message ?? '');
          setState({
            outcome: /expired/i.test(msg) ? 'expired' : 'already_used',
            email: body.email,
          });
        } else if (res.status === 404) {
          setState({outcome: 'invalid'});
        } else {
          setState({outcome: 'error'});
        }
      } catch {
        if (!cancelled) setState({outcome: 'error'});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResending(true);
    setResent(false);

    try {
      await fetch(`${API_BASE_URL}/auth/resend-confirmation`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: resendEmail}),
      });
      setResent(true);
    } catch {
      // Silently swallow — the endpoint is enum-safe so even errors don't reveal info.
    } finally {
      setResending(false);
    }
  }

  const {outcome} = state;

  return (
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
                {outcome === 'loading'
                  ? 'Confirming…'
                  : outcome === 'confirmed'
                    ? 'Email confirmed'
                    : 'Confirmation link'}
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm font-normal">
                {outcome === 'loading'
                  ? 'Please wait while we verify your email.'
                  : outcome === 'confirmed'
                    ? 'Your email has been verified successfully.'
                    : 'There was a problem with this confirmation link.'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {outcome === 'loading' && <LoadingState />}

            {outcome === 'confirmed' && <ConfirmedState email={state.email} />}

            {outcome === 'already_used' && <AlreadyUsedState />}

            {outcome === 'expired' && (
              <ExpiredState
                email={resendEmail}
                onEmailChange={setResendEmail}
                resending={resending}
                resent={resent}
                onResend={onResend}
              />
            )}

            {(outcome === 'invalid' || outcome === 'error') && (
              <InvalidState
                email={resendEmail}
                onEmailChange={setResendEmail}
                resending={resending}
                resent={resent}
                onResend={onResend}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex justify-center py-6">
      <div className="border-muted-foreground h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
    </div>
  );
}

function ConfirmedState({email}: {email?: string}) {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
        <span className="bg-emerald-600/20 text-emerald-400 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
          Confirmed
        </span>
        {email && (
          <p className="text-muted-foreground text-sm">
            <span className="text-card-foreground font-medium">{email}</span>{' '}
            has been verified.
          </p>
        )}
      </div>
      <Field className="gap-4">
        <Button
          size="lg"
          className="h-10 rounded-lg hover:bg-primary/80"
          asChild
        >
          <a href="/login">Continue to sign in</a>
        </Button>
      </Field>
    </div>
  );
}

function AlreadyUsedState() {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
        <span className="bg-amber-600/20 text-amber-400 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
          Already used
        </span>
        <p className="text-muted-foreground text-sm">
          This confirmation link has already been used. Your email is already
          verified.
        </p>
      </div>
      <Field className="gap-4">
        <Button
          size="lg"
          className="h-10 rounded-lg hover:bg-primary/80"
          asChild
        >
          <a href="/login">Continue to sign in</a>
        </Button>
      </Field>
    </div>
  );
}

function ExpiredState({
  email,
  onEmailChange,
  resending,
  resent,
  onResend,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  resending: boolean;
  resent: boolean;
  onResend: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
        <span className="bg-destructive/20 text-destructive inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
          Expired
        </span>
        <p className="text-muted-foreground text-sm">
          This confirmation link has expired. Enter your email below to request
          a fresh one.
        </p>
      </div>

      <form onSubmit={onResend} noValidate>
        <FieldGroup className="gap-4">
          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="resend-email"
              className="text-muted-foreground text-sm font-normal"
            >
              Email
            </FieldLabel>
            <Input
              id="resend-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => onEmailChange(e.target.value)}
              required
              className="dark:bg-background h-9 shadow-xs"
            />
          </Field>

          {resent && (
            <p className="text-emerald-400 text-sm">
              If that email is registered, a fresh confirmation link has been
              sent.
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={resending}
            className="h-10 rounded-lg hover:bg-primary/80"
          >
            {resending ? 'Sending…' : 'Resend confirmation'}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}

function InvalidState({
  email,
  onEmailChange,
  resending,
  resent,
  onResend,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  resending: boolean;
  resent: boolean;
  onResend: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
        <span className="bg-destructive/20 text-destructive inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
          Invalid
        </span>
        <p className="text-muted-foreground text-sm">
          This confirmation link is invalid or unknown. If you need a new one,
          enter your email below.
        </p>
      </div>

      <form onSubmit={onResend} noValidate>
        <FieldGroup className="gap-4">
          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="invalid-resend-email"
              className="text-muted-foreground text-sm font-normal"
            >
              Email
            </FieldLabel>
            <Input
              id="invalid-resend-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => onEmailChange(e.target.value)}
              required
              className="dark:bg-background h-9 shadow-xs"
            />
          </Field>

          {resent && (
            <p className="text-emerald-400 text-sm">
              If that email is registered, a fresh confirmation link has been
              sent.
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={resending}
            className="h-10 rounded-lg hover:bg-primary/80"
          >
            {resending ? 'Sending…' : 'Resend confirmation'}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
