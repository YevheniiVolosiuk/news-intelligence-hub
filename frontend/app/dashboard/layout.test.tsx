import {render, screen} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({replace: mockReplace}),
  usePathname: () => '/dashboard',
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

// Stub the heavy sidebar shell (simplebar/recharts) so jsdom never loads it.
vi.mock(
  '@/components/shadcn-space/blocks/dashboard-shell-01/app-sidebar',
  () => ({
    default: ({children}: {children: React.ReactNode}) => (
      <div data-testid="app-sidebar">{children}</div>
    ),
  }),
);

import {useAuth} from '@/lib/auth-context';
import DashboardLayout from './layout';

const mockUseAuth = vi.mocked(useAuth);

describe('DashboardLayout', () => {
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

    render(
      <DashboardLayout>
        <div>Body content</div>
      </DashboardLayout>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Body content')).not.toBeInTheDocument();
  });

  it('renders the sidebar shell and body when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: {id: '1', email: 'a@b.com'},
      loading: false,
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    render(
      <DashboardLayout>
        <div>Body content</div>
      </DashboardLayout>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});
