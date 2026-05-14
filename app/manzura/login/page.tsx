'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push('/manzura');
        router.refresh();
      } else {
        setError('Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm bg-white border border-gold/30 p-10 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-light text-charcoal tracking-wide">
            Lumière Admin
          </h1>
          <div className="gold-divider mx-auto mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-mist mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              className="w-full border border-bone px-4 py-3 text-sm outline-none focus:border-gold transition-colors bg-cream"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-mist mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full border border-bone px-4 py-3 text-sm outline-none focus:border-gold transition-colors bg-cream"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center animate-in fade-in duration-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full mt-2 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
