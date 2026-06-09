import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi, beforeEach} from 'vitest';

const mockLogout = vi.fn();

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {id: 'user-1', email: 'user@example.com'},
    loading: false,
    logout: mockLogout,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/components/auth-guard', () => ({
  AuthGuard: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

import AccountPage from './page';

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the authenticated user email', () => {
    render(<AccountPage />);
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('renders a sign out button', () => {
    render(<AccountPage />);
    expect(screen.getByRole('button', {name: /sign out/i})).toBeInTheDocument();
  });

  it('calls logout when the sign out button is clicked', async () => {
    render(<AccountPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {name: /sign out/i}));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
