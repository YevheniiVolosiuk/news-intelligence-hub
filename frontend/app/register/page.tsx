'use client';

import {useState, type FormEvent} from 'react';
import {AuthGuard} from '@/components/auth-guard';
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
import {API_BASE_URL} from '@/lib/api';

const PASSWORD_MIN_LENGTH = 12;

interface RegisterSuccess {
  devMode: boolean;
  confirmationUrl?: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

/** Route the API's flat validation messages to the field each one is about. */
function toFieldErrors(messages: string[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const msg of messages) {
    if (/email/i.test(msg)) errors.email = msg;
    else if (/password|character/i.test(msg)) errors.password = msg;
  }
  return errors;
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegisterSuccess | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password}),
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 201) {
        setSuccess(body as RegisterSuccess);
      } else if (res.status === 400) {
        const messages = Array.isArray(body.message)
          ? (body.message as string[])
          : [String(body.message)];
        setFieldErrors(toFieldErrors(messages));
      } else if (res.status === 409) {
        setFormError(String(body.message));
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
    <AuthGuard mode="guest">
      <section className="bg-foreground dark:bg-background relative flex min-h-screen items-center justify-center">
        <div className="pointer-events-none absolute inset-0 right-0 hidden overflow-hidden md:block">
          {/* Outer big circle */}
          <div className="absolute left-1/1 top-0 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10" />
          {/* Inner circle */}
          <div className="bg-foreground dark:bg-background absolute left-1/1 top-0 h-[175px] w-[175px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </div>

        <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-0 md:py-20">
          <Card className="relative max-w-lg px-6 py-8 sm:p-12">
            <CardHeader className="gap-6 p-0 text-center">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-card-foreground text-2xl font-medium">
                  {success ? 'Confirm your email' : 'Create your account'}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm font-normal">
                  {success
                    ? 'One more step to activate your account.'
                    : 'Turn your RSS feeds into a personal intelligence graph.'}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {success ? (
                <PostRegistration success={success} email={email} />
              ) : (
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
                          autoComplete="new-password"
                          placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          aria-invalid={Boolean(fieldErrors.password)}
                          aria-describedby={
                            fieldErrors.password
                              ? 'password-error'
                              : 'password-hint'
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
                        ) : (
                          <FieldDescription
                            id="password-hint"
                            className="text-muted-foreground text-xs"
                          >
                            Use at least {PASSWORD_MIN_LENGTH} characters.
                          </FieldDescription>
                        )}
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
                        {submitting ? 'Creating account…' : 'Create account'}
                      </Button>
                      <FieldDescription className="text-muted-foreground text-center text-sm font-normal">
                        Already have an account?{' '}
                        <a
                          href="/login"
                          className="text-card-foreground font-medium"
                        >
                          Sign in
                        </a>
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </AuthGuard>
  );
}

function PostRegistration({
  success,
  email,
}: {
  success: RegisterSuccess;
  email: string;
}) {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <p className="text-muted-foreground text-sm">
        We&apos;ve created your account for{' '}
        <span className="text-card-foreground font-medium">{email}</span>.
        Confirm your email address to activate it.
      </p>

      {success.devMode && success.confirmationUrl ? (
        <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
          <span className="bg-secondary text-secondary-foreground inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
            Dev mode
          </span>
          <p className="text-muted-foreground text-sm">
            No email is sent in dev mode. Use this confirmation link directly:
          </p>
          <a
            href={success.confirmationUrl}
            className="bg-background block break-all rounded-md px-3 py-2 font-mono text-xs underline underline-offset-2"
          >
            {success.confirmationUrl}
          </a>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Check your inbox for a confirmation link.
        </p>
      )}
    </div>
  );
}
