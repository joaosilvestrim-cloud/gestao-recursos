'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const error = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showPass, setShowPass] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
  }, [next, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErr(
        error.message.includes('Invalid login')
          ? 'E-mail ou senha incorretos.'
          : error.message.includes('Email not confirmed')
          ? 'Confirme seu e-mail antes de entrar.'
          : error.message
      );
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <Image src="/drivedata_logo.svg" alt="Drive Data" width={40} height={40} />
        <div>
          <p className="text-sm font-bold text-white tracking-wide">DRIVE DATA</p>
          <p className="text-[11px] text-gray-500">Portfolio Intelligence</p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-white mb-1">Entrar na plataforma</h1>
        <p className="text-sm text-gray-500 mb-6">
          Acesse com seu e-mail e senha corporativos.
        </p>

        {/* Forbidden error */}
        {error === 'forbidden' && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
            ⛔ Você não tem permissão para acessar essa página.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Senha</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {err && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-bold py-3 rounded-xl text-sm transition-colors mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-900/40 border-t-gray-900 rounded-full animate-spin" />
                Entrando…
              </span>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-[11px] text-gray-700 mt-6">
        Não tem acesso? Solicite ao administrador do sistema.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />}>
      <LoginForm />
    </Suspense>
  );
}
