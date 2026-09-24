'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Falha no login.');
        return;
      }
      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0b1220',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 24,
          border: '1px solid #1e293b',
          borderRadius: 8,
          background: '#0f172a',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-aliseo.jpg"
            alt="ALISEO"
            style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }}
          />
          <strong style={{ color: '#e2e8f0', fontSize: 15, letterSpacing: 0.5 }}>CFTV DESIGN</strong>
        </div>

        <label style={{ fontSize: 12, color: '#94a3b8' }}>
          Usuário (AD)
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            style={{ width: '100%' }}
          />
        </label>

        <label style={{ fontSize: 12, color: '#94a3b8' }}>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>

        {error && (
          <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: '1px solid #38bdf8',
            background: 'rgba(56,189,248,0.15)',
            color: '#38bdf8',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
