'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  {
    section: 'Portfólio',
    items: [
      { href: '/projects', label: 'Projetos', icon: '📁' },
      { href: '/clients', label: 'Clientes', icon: '🏢' },
    ],
  },
  {
    section: 'Equipe',
    items: [
      { href: '/collaborators', label: 'Colaboradores', icon: '👥' },
      { href: '/allocations', label: 'Alocações', icon: '📅' },
    ],
  },
  {
    section: 'Operação',
    items: [
      { href: '/timesheets', label: 'Time-Tracking', icon: '⏱️' },
      { href: '/timesheets/approve', label: 'Aprovação', icon: '✅' },
      { href: '/expenses', label: 'Despesas', icon: '🧾' },
    ],
  },
  {
    section: 'Inteligência',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '📊' },
      { href: '/dashboard/financial', label: 'Financeiro', icon: '💰' },
      { href: '/dashboard/deviations', label: 'Desvios', icon: '⚠️' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col min-h-screen">
      <div className="px-4 py-5 border-b border-gray-800">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Drive Data</p>
        <h1 className="text-sm font-bold text-white mt-0.5">Gestão de Recursos</h1>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {nav.map((group) => (
          <div key={group.section} className="mb-4">
            <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              {group.section}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800">
        <p className="text-xs text-gray-600">v0.1.0 · {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
