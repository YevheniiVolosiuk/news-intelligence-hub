'use client';

import {useCallback, useEffect, useState, type FormEvent} from 'react';
import {Pause, Play, Plus, Rss, Trash2} from 'lucide-react';
import {PageBody} from '@/components/dashboard/page-body';
import {Button} from '@/components/ui/button';
import {Card, CardContent} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {Input} from '@/components/ui/input';
import {Separator} from '@/components/ui/separator';
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

  const togglePause = useCallback(async (feed: Feed) => {
    const action = feed.status === 'paused' ? 'resume' : 'pause';
    try {
      const res = await fetch(`${API_BASE_URL}/feeds/${feed.id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const updated = (await res.json()) as Feed;
        setFeeds(prev => prev.map(f => (f.id === updated.id ? updated : f)));
      }
    } catch {
      // Best-effort; the row keeps its current status on failure.
    }
  }, []);

  const deleteFeed = useCallback(async (feed: Feed) => {
    try {
      const res = await fetch(`${API_BASE_URL}/feeds/${feed.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setFeeds(prev => prev.filter(f => f.id !== feed.id));
      }
    } catch {
      // Best-effort; the row stays put on failure.
    }
  }, []);

  return (
    <PageBody
      title="Feeds"
      description="Add RSS/Atom sources and track their status."
    >
      <div className="grid grid-cols-12 gap-6">
        {/* ------------------------- Add feed form ------------------------- */}
        <div className="col-span-12 xl:col-span-5">
          <Card className="ring-0 border rounded-2xl">
            <CardContent className="flex flex-col gap-6 p-6">
              <div className="flex items-center gap-3">
                <span className="bg-muted/60 text-card-foreground flex size-9 items-center justify-center rounded-xl">
                  <Rss size={16} />
                </span>
                <div className="flex flex-col">
                  <p className="text-card-foreground text-base font-medium">
                    Add a feed
                  </p>
                  <p className="text-muted-foreground text-xs font-normal">
                    Paste a feed URL to start following a source.
                  </p>
                </div>
              </div>

              <Separator />

              <form onSubmit={onSubmit} noValidate>
                <FieldGroup className="gap-4">
                  <Field className="gap-1.5">
                    <FieldLabel
                      htmlFor="feed-url"
                      className="text-muted-foreground text-sm font-normal"
                    >
                      Feed URL*
                    </FieldLabel>
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
                    {error ? (
                      <FieldDescription className="text-destructive text-xs">
                        {error}
                      </FieldDescription>
                    ) : (
                      <FieldDescription className="text-xs">
                        Supports RSS and Atom feeds.
                      </FieldDescription>
                    )}
                  </Field>
                  <Button
                    type="submit"
                    disabled={submitting || url.trim() === ''}
                    className="h-9 w-full gap-1.5 rounded-lg hover:bg-primary/80"
                  >
                    <Plus size={16} />
                    {submitting ? 'Adding…' : 'Add feed'}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* --------------------------- Feed list --------------------------- */}
        <div className="col-span-12 xl:col-span-7">
          <Card className="ring-0 border rounded-2xl">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <p className="text-card-foreground text-base font-medium">
                  Your sources
                </p>
                <span className="text-muted-foreground text-xs font-medium">
                  {feeds.length} {feeds.length === 1 ? 'feed' : 'feeds'}
                </span>
              </div>

              <ul className="flex flex-col gap-2">
                {feeds.length === 0 ? (
                  <li className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                    No feeds yet. Add one on the left to get started.
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
                      <div className="flex shrink-0 items-center gap-2">
                        <FeedStatusBadge status={feed.status} />
                        {feed.status !== 'error' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void togglePause(feed)}
                            className="h-8 gap-1.5 rounded-lg px-2.5"
                          >
                            {feed.status === 'paused' ? (
                              <>
                                <Play size={14} />
                                Resume
                              </>
                            ) : (
                              <>
                                <Pause size={14} />
                                Pause
                              </>
                            )}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void deleteFeed(feed)}
                          className="text-muted-foreground hover:text-destructive h-8 gap-1.5 rounded-lg px-2.5"
                        >
                          <Trash2 size={14} />
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageBody>
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
