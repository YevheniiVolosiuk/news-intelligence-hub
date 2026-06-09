'use client';

import {useState, type FormEvent} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-slate-400">
          Start turning your RSS feeds into a personal intelligence graph.
        </p>
      </header>

      {success ? (
        <PostRegistration success={success} email={email} />
      ) : (
        <form
          onSubmit={onSubmit}
          noValidate
          className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              required
            />
            {fieldErrors.email ? (
              <p id="email-error" className="text-xs text-rose-400">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
                fieldErrors.password ? 'password-error' : 'password-hint'
              }
              required
            />
            {fieldErrors.password ? (
              <p id="password-error" className="text-xs text-rose-400">
                {fieldErrors.password}
              </p>
            ) : (
              <p id="password-hint" className="text-xs text-slate-500">
                Use at least {PASSWORD_MIN_LENGTH} characters.
              </p>
            )}
          </div>

          {formError ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {formError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      )}
    </main>
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
    <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-medium text-slate-100">
          Confirm your email
        </h2>
        <p className="text-sm text-slate-400">
          We&apos;ve created your account for{' '}
          <span className="text-slate-200">{email}</span>. Confirm your email
          address to activate it.
        </p>
      </div>

      {success.devMode && success.confirmationUrl ? (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Dev mode
          </span>
          <p className="text-sm text-amber-100/80">
            No email is sent in dev mode. Use this confirmation link directly:
          </p>
          <a
            href={success.confirmationUrl}
            className="block break-all rounded-md bg-slate-950/60 px-3 py-2 font-mono text-xs text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
          >
            {success.confirmationUrl}
          </a>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Check your inbox for a confirmation link.
        </p>
      )}
    </section>
  );
}
