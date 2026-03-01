// src/features/auth/AuthPanel.tsx
import type { FormEvent } from 'react';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from './AuthContext';

export const AuthPanel = () => {
  const { user, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Supabase Auth の redirect URL
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error('signInWithOtp error', error);
      setStatusMessage(`ログインリンク送信に失敗: ${error.message}`);
    } else {
      setStatusMessage('ログイン用リンクをメールに送ったよ。メールを確認してね！');
    }
    setIsSubmitting(false);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('signOut error', error);
      setStatusMessage(`ログアウトに失敗: ${error.message}`);
    } else {
      setStatusMessage('ログアウトしたよ。');
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #eee',
          fontSize: 14,
        }}
      >
        認証状態を確認中…
      </div>
    );
  }

  // ログイン前 UI
  if (!user) {
    return (
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <label style={{ fontSize: 14 }}>
            ログイン用メール:
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                marginLeft: 4,
                padding: '4px 8px',
                fontSize: 14,
              }}
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '4px 12px',
              fontSize: 14,
              cursor: isSubmitting ? 'default' : 'pointer',
            }}
          >
            {isSubmitting ? '送信中…' : 'ログインリンク送信'}
          </button>
        </form>
        {statusMessage && <div style={{ fontSize: 12 }}>{statusMessage}</div>}
      </div>
    );
  }

  // ログイン後 UI
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontSize: 14,
      }}
    >
      <div>
        ログイン中: <strong>{user.email}</strong>
      </div>
      <div>
        userId: <code>{user.id}</code>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            padding: '4px 10px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          ログアウト
        </button>
        {/* 将来「記録ページへ」などのナビゲーション追加する枠 */}
      </div>
      {statusMessage && <div style={{ fontSize: 12 }}>{statusMessage}</div>}
    </div>
  );
};