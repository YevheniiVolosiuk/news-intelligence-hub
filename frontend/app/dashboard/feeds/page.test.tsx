import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi, beforeEach} from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import FeedsPage from './page';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('Dashboard FeedsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a feed and shows it in the list after submitting a valid URL', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, []));

    render(<FeedsPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText(/feed url/i)).toBeInTheDocument();
    });

    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, {
        id: 'f1',
        url: 'https://news.example.com/rss',
        title: null,
        status: 'active',
        createdAt: '2026-06-10T00:00:00.000Z',
        updatedAt: '2026-06-10T00:00:00.000Z',
      }),
    );

    await user.type(
      screen.getByLabelText(/feed url/i),
      'https://news.example.com/rss',
    );
    await user.click(screen.getByRole('button', {name: /add feed/i}));

    await waitFor(() => {
      expect(
        screen.getByText('https://news.example.com/rss'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });
});
