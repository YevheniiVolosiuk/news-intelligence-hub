import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi, beforeEach} from 'vitest';

// Must mock before importing the component.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {id: '1', email: 'a@b.com'},
    loading: false,
    logout: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('@/components/auth-guard', () => ({
  AuthGuard: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

import FeedsPage from './page';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('FeedsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the newly added Feed in the list after submitting a valid URL', async () => {
    // Initial GET /feeds on mount -> empty list.
    mockFetch.mockResolvedValueOnce(jsonResponse(200, []));

    render(<FeedsPage />);
    const user = userEvent.setup();

    // The empty list resolves first.
    await waitFor(() => {
      expect(screen.getByLabelText(/feed url/i)).toBeInTheDocument();
    });

    // POST /feeds -> the created Feed at status active.
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
