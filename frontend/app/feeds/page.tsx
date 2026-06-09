'use client';

import {useCallback, useEffect, useState, type FormEvent} from 'react';
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

interface Feed {
  id: string;
  url: string;
  title: string | null;
  status: 'active' | 'paused' | 'error';
  createdAt: string;
  updatedAt: string;
}

export default function FeedsPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeeds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/feeds`, {
        credentials: 'include',
      });
      if (res.ok) {
        setFeeds((await res.json()) as Feed[]);
      }
    } catch {
      // Best-effort load; the add form still works.
    }
  }, []);

  useEffect(() => {
    void loadFeeds();
  }, [loadFeeds]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/feeds`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify({url}),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        setFeeds(prev => [body as Feed, ...prev]);
        setUrl('');
      } else if (body?.reason) {
        setError(reasonMessage(String(body.reason)));
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGuard mode="auth">
      <section className="bg-background flex min-h-screen justify-center">
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 md:py-16">
          <Card className="px-6 py-8 sm:p-10">
            <CardHeader className="gap-2 p-0">
              <CardTitle className="text-card-foreground text-2xl font-medium">
                Your Feeds
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Add an RSS/Atom URL to follow a source.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <form onSubmit={onSubmit} noValidate className="pt-6">
                <FieldGroup className="gap-3">
                  <Field className="gap-1.5">
                    <FieldLabel
                      htmlFor="feed-url"
                      className="text-muted-foreground text-sm font-normal"
                    >
                      Feed URL*
                    </FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id="feed-url"
                        name="url"
                        type="url"
                        inputMode="url"
                        placeholder="https://example.com/feed.xml"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        aria-invalid={Boolean(error)}
                        required
                        className="dark:bg-background h-9 shadow-xs"
                      />
                      <Button
                        type="submit"
                        disabled={submitting || url.trim() === ''}
                        className="h-9 shrink-0 rounded-lg hover:bg-primary/80"
                      >
                        {submitting ? 'Adding…' : 'Add feed'}
                      </Button>
                    </div>
                    {error ? (
                      <FieldDescription className="text-destructive text-xs">
                        {error}
                      </FieldDescription>
                    ) : null}
                  </Field>
                </FieldGroup>
              </form>

              <ul className="flex flex-col gap-2 pt-6">
                {feeds.length === 0 ? (
                  <li className="text-muted-foreground text-sm">
                    No feeds yet. Add one above to get started.
                  </li>
                ) : (
                  feeds.map(feed => (
                    <li
                      key={feed.id}
                      className="border-border bg-muted/40 flex items-center justify-between gap-4 rounded-lg border p-3"
                    >
                      <div className="flex min-w-0 flex-col">
                        {feed.title ? (
                          <span className="text-card-foreground truncate text-sm font-medium">
                            {feed.title}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground truncate text-sm">
                          {feed.url}
                        </span>
                      </div>
                      <FeedStatusBadge status={feed.status} />
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </AuthGuard>
  );
}

function FeedStatusBadge({status}: {status: Feed['status']}) {
  const tone =
    status === 'active'
      ? 'bg-success/15 text-success'
      : status === 'paused'
        ? 'bg-warning/15 text-warning'
        : 'bg-destructive/15 text-destructive';
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tone}`}
    >
      {status}
    </span>
  );
}

/** Maps a validator rejection reason to human-readable copy (US-4). */
function reasonMessage(reason: string): string {
  switch (reason) {
    case 'malformed':
      return 'That doesn’t look like a valid URL.';
    case 'unreachable':
      return 'We couldn’t reach that URL. Check it and try again.';
    case 'not-a-feed':
      return 'That URL isn’t an RSS/Atom feed.';
    case 'timeout':
      return 'That source took too long to respond. Try again later.';
    case 'duplicate':
      return 'You’re already following that feed.';
    default:
      return 'That feed couldn’t be added.';
  }
}
