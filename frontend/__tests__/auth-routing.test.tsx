import {render, screen} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({replace: mockReplace}),
  useSearchParams: () => ({get: () => null}),
}));

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

// Stub fetch so pages don't hit the network.
vi.stubGlobal('fetch', vi.fn());

import {AuthGuard} from '@/components/auth-guard';
import AccountPage from '@/app/account/page';
import LoginPage from '@/app/login/page';
import RegisterPage from '@/app/register/page';

describe('Auth routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function authed() {
    return {
      user: {id: '1', email: 'a@b.com'},
      loading: false,
      logout: vi.fn(),
      refetch: vi.fn(),
    };
  }

  function unauthed() {
    return {
      user: null,
      loading: false,
      logout: vi.fn(),
      refetch: vi.fn(),
    };
  }

  it('redirects to /login when unauthenticated on /account', () => {
    mockUseAuth.mockReturnValue(unauthed());

    render(
      <AuthGuard mode="auth">
        <AccountPage />
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('a@b.com')).not.toBeInTheDocument();
  });

  it('renders account content when authenticated', () => {
    mockUseAuth.mockReturnValue(authed());

    render(
      <AuthGuard mode="auth">
        <AccountPage />
      </AuthGuard>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
  });

  it('redirects to /dashboard when authenticated on /login', () => {
    mockUseAuth.mockReturnValue(authed());

    render(
      <AuthGuard mode="guest">
        <LoginPage />
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects to /dashboard when authenticated on /register', () => {
    mockUseAuth.mockReturnValue(authed());

    render(
      <AuthGuard mode="guest">
        <RegisterPage />
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('shows spinner while loading on protected page', () => {
    mockUseAuth.mockReturnValue({
      ...unauthed(),
      loading: true,
    });

    const {container} = render(
      <AuthGuard mode="auth">
        <AccountPage />
      </AuthGuard>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
