// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

type AuthStateChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../../00_common/src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));

import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

const createSession = (id: string, email: string): Session => {
  const user: User = {
    id,
    email,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-11-28T00:00:00.000Z',
  };

  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
};

function AuthProbe() {
  const { session, user, isLoading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user-id">{user?.id ?? 'none'}</span>
      <span data-testid="session-token">{session?.access_token ?? 'none'}</span>
    </div>
  );
}

describe('AuthProvider and useAuth', () => {
  let authStateCallback: AuthStateChangeCallback | null = null;

  beforeEach(() => {
    authStateCallback = null;
    mocks.getSession.mockReset();
    mocks.onAuthStateChange.mockReset();
    mocks.unsubscribe.mockReset();

    mocks.onAuthStateChange.mockImplementation((callback: AuthStateChangeCallback) => {
      authStateCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: mocks.unsubscribe,
          },
        },
      };
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('restores the initial session and shares context between AuthProvider and useAuth', async () => {
    const initialSession = createSession('user-1', 'user1@example.com');
    let resolveSession: (value: { data: { session: Session | null }; error: null }) => void = () => {};
    mocks.getSession.mockReturnValue(
      new Promise<{ data: { session: Session | null }; error: null }>((resolve) => {
        resolveSession = resolve;
      }),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('user-id').textContent).toBe('none');

    await act(async () => {
      resolveSession({ data: { session: initialSession }, error: null });
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user-id').textContent).toBe('user-1');
    expect(screen.getByTestId('session-token').textContent).toBe('test-access-token');
  });

  it('finishes loading safely when getSession returns an error', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'session read failed' },
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user-id').textContent).toBe('none');
    expect(console.error).toHaveBeenCalled();
  });

  it('updates session and user on auth state changes and unsubscribes on unmount', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { unmount } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(authStateCallback).not.toBeNull();

    const signedInSession = createSession('user-2', 'user2@example.com');
    act(() => {
      authStateCallback?.('SIGNED_IN', signedInSession);
    });
    expect(screen.getByTestId('user-id').textContent).toBe('user-2');
    expect(screen.getByTestId('session-token').textContent).toBe('test-access-token');

    act(() => {
      authStateCallback?.('SIGNED_OUT', null);
    });
    expect(screen.getByTestId('user-id').textContent).toBe('none');
    expect(screen.getByTestId('session-token').textContent).toBe('none');

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('ignores delayed getSession completion after unmount', async () => {
    let resolveSession: (value: { data: { session: Session | null }; error: null }) => void = () => {};
    mocks.getSession.mockReturnValue(
      new Promise<{ data: { session: Session | null }; error: null }>((resolve) => {
        resolveSession = resolve;
      }),
    );

    const { unmount } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSession({ data: { session: createSession('late-user', 'late@example.com') }, error: null });
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('throws when useAuth is called outside AuthProvider', () => {
    expect(() => render(<AuthProbe />)).toThrow('useAuth must be used within <AuthProvider>');
  });
});
