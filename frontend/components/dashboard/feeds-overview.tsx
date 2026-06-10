'use client';

import {useCallback, useEffect, useState} from 'react';
import {Card, CardContent} from '@/components/ui/card';
import {API_BASE_URL} from '@/lib/api';

interface Feed {
  id: string;
  url: string;
  title: string | null;
  status: 'active' | 'paused' | 'error';
  createdAt: string;
  updatedAt: string;
}

type StatusCounts = Record<Feed['status'], number>;

const STAT_CARDS: Array<{key: keyof StatusCounts; label: string}> = [
  {key: 'active', label: 'Active'},
  {key: 'paused', label: 'Paused'},
  {key: 'error', label: 'Error'},
];

export default function FeedsOverview() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadFeeds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/feeds`, {
        credentials: 'include',
      });
      if (res.ok) {
        setFeeds((await res.json()) as Feed[]);
      }
    } catch {
      // Best-effort; the dashboard still renders an empty overview.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadFeeds();
  }, [loadFeeds]);

  const counts: StatusCounts = {active: 0, paused: 0, error: 0};
  for (const feed of feeds) counts[feed.status] += 1;
  const recent = feeds.slice(0, 5);

  return (
    <Card className="ring-0 border rounded-2xl">
      <CardContent className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-medium text-card-foreground">
              Feeds overview
            </p>
            <p className="text-xs font-normal text-muted-foreground">
              Sources you follow and their current status.
            </p>
          </div>
          <a
            href="/dashboard/feeds"
            className="text-card-foreground text-sm font-medium hover:underline"
          >
            View all
          </a>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat testId="stat-total" label="Total" value={feeds.length} />
          {STAT_CARDS.map(({key, label}) => (
            <Stat
              key={key}
              testId={`stat-${key}`}
              label={label}
              value={counts[key]}
            />
          ))}
        </div>

        <ul className="flex flex-col gap-2">
          {loaded && feeds.length === 0 ? (
            <li className="text-muted-foreground text-sm">
              No feeds yet.{' '}
              <a
                href="/dashboard/feeds"
                className="text-card-foreground font-medium"
              >
                Add one
              </a>{' '}
              to get started.
            </li>
          ) : (
            recent.map(feed => (
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
                <StatusBadge status={feed.status} />
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function Stat({
  testId,
  label,
  value,
}: {
  testId: string;
  label: string;
  value: number;
}) {
  return (
    <div
      data-testid={testId}
      className="border-border bg-muted/40 flex flex-col gap-1 rounded-lg border p-4"
    >
      <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        {label}
      </span>
      <span className="text-card-foreground text-2xl font-medium">{value}</span>
    </div>
  );
}

function StatusBadge({status}: {status: Feed['status']}) {
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
