'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROLE_LABELS, ROLE_COLORS, type Role } from '@/lib/auth/roles';

export default function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('collaborator');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setEmail(data.user.email ?? '');
      setName(data.user.user_metadata?.name ?? data.user.email?.split('@')[0] ?? '');
      setRole((data.user.user_metadata?.role as Role) ?? 'collaborator');
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <div ref={ref} className="relative px-3 py-3 border-t border-white/5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/50 to-purple-500/50 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-gray-300 truncate">{name || email}</p>
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border mt-0.5 ${ROLE_COLORS[role]}`}>
            {ROLE_LABELS[role]}
          </span>
        </div>
        <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold text-white truncate">{name}</p>
            <p className="text-[11px] text-gray-500 truncate">{email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <span>🚪</span> Sair
          </button>
        </div>
      )}
    </div>
  );
}
