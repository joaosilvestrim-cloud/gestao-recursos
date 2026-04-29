'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const nav = [
  {
    section: 'Command Center',
    items: [
      {
        href: '/dashboard',
        label: 'Visão Executiva',
        icon: '📊',
        desc: 'Painel de comando: KPIs de receita, custo, margem e projetos em risco em tempo real.',
      },
      {
        href: '/dashboard/pl',
        label: 'P&L por Conta',
        icon: '💰',
        desc: 'Demonstrativo de lucros e perdas consolidado por grupo, cliente e projeto.',
      },
      {
        href: '/dashboard/billing',
        label: 'Faturamento',
        icon: '🔔',
        desc: 'Marcos de faturamento, notas pendentes e alertas de cobrança por projeto.',
      },
      {
        href: '/dashboard/capacity',
        label: 'Capacity Forecast',
        icon: '🔭',
        desc: 'Projeção de ocupação da equipe com base nos projetos ativos e pipeline.',
      },
    ],
  },
  {
    section: 'Portfólio',
    items: [
      {
        href: '/groups',
        label: 'Grupos / Contas',
        icon: '🏛️',
        desc: 'Holdings e unidades de negócio (Tambasa, Zenatur, Eagles Group). Agrupa clientes para P&L consolidado.',
      },
      {
        href: '/clients',
        label: 'Clientes',
        icon: '🏢',
        desc: 'Empresas contratantes dos projetos. Vinculados a um grupo holding para consolidação financeira.',
      },
      {
        href: '/projects',
        label: 'Projetos',
        icon: '📁',
        desc: 'Contratos ativos com orçamento, CPI e saúde financeira. Aqui você define o "balde de dinheiro".',
      },
      {
        href: '/pipeline',
        label: 'Pipeline',
        icon: '📈',
        desc: 'Oportunidades em negociação. Alimenta o Capacity Forecast com demanda futura da equipe.',
      },
    ],
  },
  {
    section: 'Dados Financeiros',
    items: [
      {
        href: '/cost-entries',
        label: 'Lançar / Importar',
        icon: '⬆️',
        desc: 'Importe horas do Clockify via CSV ou lance manualmente. O custo H/H é calculado automaticamente.',
      },
      {
        href: '/indirect-costs',
        label: 'Custos Indiretos',
        icon: '🧾',
        desc: 'SGA (despesas administrativas e de suporte) rateados entre os projetos para apurar margem real.',
      },
      {
        href: '/expenses',
        label: 'Despesas Extra',
        icon: '💳',
        desc: 'Licenças de software, viagens, contratados PJ e outros custos diretos atribuídos por projeto.',
      },
    ],
  },
  {
    section: 'Cadastros',
    items: [
      {
        href: '/collaborators',
        label: 'Colaboradores',
        icon: '👥',
        desc: 'Equipe com custo H/H cadastrado. Base do motor financeiro — todo cálculo de margem parte daqui.',
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 flex flex-col min-h-screen bg-gray-950 border-r border-white/5">
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
                  className={`group flex items-start gap-2.5 mx-2 px-3 py-2.5 rounded-lg transition-all ${
                    active
                      ? 'bg-gradient-to-r from-cyan-500/20 to-green-500/10 text-cyan-400'
                      : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <span className="text-sm leading-none w-4 text-center mt-0.5 shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-sm leading-tight ${active ? 'font-medium text-cyan-400' : 'text-gray-300 group-hover:text-white'} flex items-center gap-1`}>
                      {item.label}
                      {active && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />}
                    </p>
                    <p className={`text-[10px] leading-snug mt-0.5 ${active ? 'text-cyan-400/60' : 'text-gray-600 group-hover:text-gray-500'}`}>
                      {item.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/5">
        <p className="text-[10px] text-gray-700">v0.3.0 · {new Date().getFullYear()} Drive Data</p>
      </div>
    </aside>
  );
}
