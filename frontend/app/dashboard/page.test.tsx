import {render, screen} from '@testing-library/react';
import {describe, it, expect, vi} from 'vitest';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {id: '1', email: 'ada@example.com'},
    loading: false,
    logout: vi.fn(),
    refetch: vi.fn(),
  }),
}));

// Stub the heavy overview block (recharts/motion/simplebar) so jsdom never loads it.
vi.mock('@/components/shadcn-space/blocks/dashboard-shell-01/page', () => ({
  default: () => <div>Dashboard overview</div>,
}));

import DashboardPage from './page';

describe('DashboardPage', () => {
  it('greets the signed-in user and renders the overview', () => {
    render(<DashboardPage />);

    expect(screen.getByText(/welcome back, ada/i)).toBeInTheDocument();
    expect(screen.getByText('Dashboard overview')).toBeInTheDocument();
  });
});
