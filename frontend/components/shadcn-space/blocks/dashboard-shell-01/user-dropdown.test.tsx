import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi, beforeEach} from 'vitest';

const mockLogout = vi.fn();

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {id: '1', email: 'reader@example.com'},
    loading: false,
    logout: mockLogout,
    refetch: vi.fn(),
  }),
}));

import UserDropdown from './user-dropdown';

describe('UserDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the signed-in email', () => {
    render(<UserDropdown trigger={<button>menu</button>} defaultOpen />);

    expect(screen.getByText('reader@example.com')).toBeInTheDocument();
  });

  it('calls logout when Signout is clicked', async () => {
    render(<UserDropdown trigger={<button>menu</button>} defaultOpen />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/signout/i));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
