'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ADMIN_NAV = [
  { href: '/admin', label: 'Visão Geral', icon: '🏠', exact: true },
  { href: '/admin/users', label: 'Usuários & Acessos', icon: '👥' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-full">
      {/* Admin top bar */}
      <div className="border-b border-white/5 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-1 px-6 py-0">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-widest mr-4 py-3">
            🔐 Admin
          </span>
          {ADMIN_NAV.map(item => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-all ${
                  active
                    ? 'border-cyan-500 text-cyan-400 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-200'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
