'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/financeiro',         label: 'Balanço',           icon: '⚖️',  exact: true },
  { href: '/financeiro/receber', label: 'Contas a Receber',  icon: '📥' },
  { href: '/financeiro/pagar',   label: 'Contas a Pagar',    icon: '📤' },
  { href: '/financeiro/fluxo',   label: 'Fluxo de Caixa',   icon: '📊' },
];

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-full">
      {/* Tab bar */}
      <div className="border-b border-white/5 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-1 px-6 py-0">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-widest mr-4 py-3">
            💰 Financeiro
          </span>
          {TABS.map(tab => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? 'border-cyan-500 text-cyan-400 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-200'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex-1">{children}</div>
    </div>
  );
}
