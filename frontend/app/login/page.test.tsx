import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi, beforeEach} from 'vitest';

// Must mock before importing the component.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Capture window.location.href writes.
const originalLocation = window.location;
let capturedHref = '';
Object.defineProperty(window, 'location', {
  writable: true,
  value: {
    ...originalLocation,
    set href(url: string) {
      capturedHref = url;
    },
    get href() {
      return capturedHref || originalLocation.href;
    },
  },
});

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    logout: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('@/components/auth-guard', () => ({
  AuthGuard: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

import LoginPage from './page';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHref = '';
  });

  it('redirects to /dashboard after successful login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({id: '1', email: 'a@b.com'}),
    });

    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'password12345');
    await user.click(screen.getByRole('button', {name: /sign in/i}));

    await waitFor(() => {
      expect(capturedHref).toBe('/dashboard');
    });
  });
});
