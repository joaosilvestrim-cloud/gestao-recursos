'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const nav = [
  {
    section: 'Command Center',
    items: [
      { href: '/dashboard', label: 'Visão Executiva', icon: '📊' },
      { href: '/dashboard/pl', label: 'P&L por Conta', icon: '💰' },
      { href: '/dashboard/billing', label: 'Faturamento', icon: '🔔' },
      { href: '/dashboard/capacity', label: 'Capacity Forecast', icon: '🔭' },
    ],
  },
  {
    section: 'Portfólio',
    items: [
      { href: '/groups', label: 'Grupos / Contas', icon: '🏛️' },
      { href: '/clients', label: 'Clientes', icon: '🏢' },
      { href: '/projects', label: 'Projetos', icon: '📁' },
      { href: '/pipeline', label: 'Pipeline', icon: '📈' },
    ],
  },
  {
    section: 'Dados Financeiros',
    items: [
      { href: '/cost-entries', label: 'Lançar / Importar', icon: '⬆️' },
      { href: '/indirect-costs', label: 'Custos Indiretos', icon: '🧾' },
      { href: '/expenses', label: 'Despesas Extra', icon: '💳' },
    ],
  },
  {
    section: 'Cadastros',
    items: [
      { href: '/collaborators', label: 'Colaboradores', icon: '👥' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 flex flex-col min-h-screen bg-gray-950 border-r border-white/5">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-5 py-5 border-b border-white/5 hover:bg-white/5 transition-colors">
        <Image src="/drivedata_logo.svg" alt="Drive Data" width={32} height={32} />
        <div>
          <p className="text-[11px] font-bold text-white leading-none tracking-wide">DRIVE DATA</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Portfolio Intelligence</p>
        </div>
      </Link>

      <nav className="flex-1 py-3 overflow-y-auto">
        {nav.map((group) => (
          <div key={group.section} className="mb-1">
            <p className="px-5 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              {group.section}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    active
                      ? 'bg-gradient-to-r from-cyan-500/20 to-green-500/10 text-cyan-400 font-medium'
                      : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <span className="text-sm leading-none w-4 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/5">
        <p className="text-[10px] text-gray-700">v0.2.0 · {new Date().getFullYear()} Drive Data</p>
      </div>
    </aside>
  );
}
