import {render, screen} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {AuthGuard} from './auth-guard';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({replace: mockReplace}),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

import {useAuth} from '@/lib/auth-context';
const mockUseAuth = vi.mocked(useAuth);

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when unauthenticated and loading is done', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    render(
      <AuthGuard mode="auth">
        <div>Protected content</div>
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects to /account when authenticated in guest mode', () => {
    mockUseAuth.mockReturnValue({
      user: {id: '1', email: 'a@b.com'},
      loading: false,
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    render(
      <AuthGuard mode="guest">
        <div>Guest content</div>
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/account');
    expect(screen.queryByText('Guest content')).not.toBeInTheDocument();
  });

  it('renders children when unauthenticated in guest mode', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    render(
      <AuthGuard mode="guest">
        <div>Guest content</div>
      </AuthGuard>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByText('Guest content')).toBeInTheDocument();
  });

  it('renders a loading spinner and does not redirect while loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    const {container} = render(
      <AuthGuard mode="auth">
        <div>Protected content</div>
      </AuthGuard>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    // Spinner is rendered
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders children when authenticated in auth mode', () => {
    mockUseAuth.mockReturnValue({
      user: {id: '1', email: 'a@b.com'},
      loading: false,
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    render(
      <AuthGuard mode="auth">
        <div>Protected content</div>
      </AuthGuard>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
