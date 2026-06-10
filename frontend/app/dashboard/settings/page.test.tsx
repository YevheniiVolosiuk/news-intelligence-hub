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

import SettingsPage from './page';

describe('Dashboard SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the authenticated user email', () => {
    render(<SettingsPage />);
    expect(screen.getByDisplayValue('user@example.com')).toBeInTheDocument();
  });

  it('calls logout when sign out is clicked', async () => {
    render(<SettingsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {name: /sign out/i}));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
