import {render, screen, waitFor, within} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import FeedsOverview from './feeds-overview';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

function feed(overrides: Record<string, unknown>) {
  return {
    id: 'f1',
    url: 'https://news.example.com/rss',
    title: null,
    status: 'active',
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('FeedsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows total and per-status counts plus a recent feed from GET /feeds', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, [
        feed({id: 'a', url: 'https://a.example/rss', status: 'active'}),
        feed({id: 'b', url: 'https://b.example/rss', status: 'active'}),
        feed({id: 'c', url: 'https://c.example/rss', status: 'paused'}),
      ]),
    );

    render(<FeedsOverview />);

    const total = await screen.findByTestId('stat-total');
    expect(within(total).getByText('3')).toBeInTheDocument();

    expect(
      within(screen.getByTestId('stat-active')).getByText('2'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('stat-paused')).getByText('1'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('stat-error')).getByText('0'),
    ).toBeInTheDocument();

    expect(screen.getByText('https://a.example/rss')).toBeInTheDocument();
  });

  it('shows an empty state when there are no feeds', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, []));

    render(<FeedsOverview />);

    await waitFor(() => {
      expect(screen.getByText(/no feeds yet/i)).toBeInTheDocument();
    });
  });
});
