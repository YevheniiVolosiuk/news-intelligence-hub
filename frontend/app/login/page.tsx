'use client';

import {useState, type FormEvent} from 'react';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {Input} from '@/components/ui/input';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

interface FieldErrors {
  email?: string;
  password?: string;
}

function toFieldErrors(messages: string[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const msg of messages) {
    if (/email/i.test(msg)) errors.email = msg;
    else if (/password|character/i.test(msg)) errors.password = msg;
  }
  return errors;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify({email, password}),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        window.location.href = '/';
      } else if (res.status === 400) {
        const messages = Array.isArray(body.message)
          ? (body.message as string[])
          : [String(body.message)];
        setFieldErrors(toFieldErrors(messages));
      } else if (res.status === 401) {
        setFormError('Invalid email or password.');
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

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
                Welcome back
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm font-normal">
                Sign in to your account.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <form onSubmit={onSubmit} noValidate>
              <FieldGroup className="gap-6">
                <div className="flex flex-col gap-4">
                  <Field className="gap-1.5">
                    <FieldLabel
                      htmlFor="email"
                      className="text-muted-foreground text-sm font-normal"
                    >
                      Email*
                    </FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={
                        fieldErrors.email ? 'email-error' : undefined
                      }
                      required
                      className="dark:bg-background h-9 shadow-xs"
                    />
                    {fieldErrors.email ? (
                      <FieldDescription
                        id="email-error"
                        className="text-destructive text-xs"
                      >
                        {fieldErrors.email}
                      </FieldDescription>
                    ) : null}
                  </Field>

                  <Field className="gap-1.5">
                    <FieldLabel
                      htmlFor="password"
                      className="text-muted-foreground text-sm font-normal"
                    >
                      Password*
                    </FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={
                        fieldErrors.password ? 'password-error' : undefined
                      }
                      required
                      className="dark:bg-background h-9 shadow-xs"
                    />
                    {fieldErrors.password ? (
                      <FieldDescription
                        id="password-error"
                        className="text-destructive text-xs"
                      >
                        {fieldErrors.password}
                      </FieldDescription>
                    ) : null}
                  </Field>
                </div>

                {formError ? (
                  <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                    {formError}
                  </p>
                ) : null}

                <Field className="gap-4">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting}
                    className="h-10 rounded-lg hover:bg-primary/80"
                  >
                    {submitting ? 'Signing in…' : 'Sign in'}
                  </Button>
                  <FieldDescription className="text-muted-foreground text-center text-sm font-normal">
                    Don&apos;t have an account?{' '}
                    <a
                      href="/register"
                      className="text-card-foreground font-medium"
                    >
                      Create one
                    </a>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
