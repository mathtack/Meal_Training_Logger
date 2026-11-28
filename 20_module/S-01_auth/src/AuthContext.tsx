import {
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../00_common/src/lib/supabaseClient';
import { AuthContext } from './useAuth';
import type { AuthContextValue } from './useAuth';

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        console.error('Supabase getSession error', error);
      } else {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }
      setIsLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // event: 'SIGNED_IN' / 'SIGNED_OUT' / ...
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        console.log('[Auth] user logged in', {
          id: session.user.id,
          email: session.user.email,
        });
      } else {
        console.log('[Auth] user logged out');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
