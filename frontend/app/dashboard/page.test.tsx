import {render, screen} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({replace: mockReplace}),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

// Stub the heavy block (recharts/motion/simplebar) so jsdom never loads it.
vi.mock('@/components/shadcn-space/blocks/dashboard-shell-01/page', () => ({
  default: () => <div>Dashboard shell</div>,
}));

import {useAuth} from '@/lib/auth-context';
import DashboardPage from './page';

const mockUseAuth = vi.mocked(useAuth);

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when unauthenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    render(<DashboardPage />);

    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Dashboard shell')).not.toBeInTheDocument();
  });

  it('renders the dashboard shell when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: {id: '1', email: 'a@b.com'},
      loading: false,
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    render(<DashboardPage />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByText('Dashboard shell')).toBeInTheDocument();
  });
});
