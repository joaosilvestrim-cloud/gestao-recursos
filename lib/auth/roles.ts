export type Role = 'director' | 'finance' | 'manager' | 'collaborator';

export const ROLE_LABELS: Record<Role, string> = {
  director:     '👑 Diretoria',
  finance:      '💼 Financeiro',
  manager:      '🧑‍💼 Gerente',
  collaborator: '👤 Colaborador',
};

export const ROLE_COLORS: Record<Role, string> = {
  director:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  finance:      'bg-blue-500/15 text-blue-400 border-blue-500/30',
  manager:      'bg-green-500/15 text-green-400 border-green-500/30',
  collaborator: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export const ROUTE_PERMISSIONS: { prefix: string; roles: Role[] | 'all' }[] = [
  // Admin
  { prefix: '/admin', roles: ['director'] },

  // Command Center
  { prefix: '/dashboard', roles: ['director', 'finance'] },

  // Financeiro (novo módulo)
  { prefix: '/financeiro', roles: ['director', 'finance'] },

  // Portfólio
  { prefix: '/groups',   roles: ['director', 'finance'] },
  { prefix: '/clients',  roles: ['director', 'finance', 'manager'] },
  { prefix: '/projects', roles: ['director', 'finance', 'manager'] },
  { prefix: '/pipeline', roles: ['director', 'manager'] },

  // Operações
  { prefix: '/cost-entries',   roles: ['director', 'manager'] },
  { prefix: '/indirect-costs', roles: ['director', 'finance'] },
  { prefix: '/expenses',       roles: ['director', 'finance', 'manager'] },

  // Pessoas
  { prefix: '/collaborators', roles: ['director', 'finance', 'manager'] },

  // Wiki
  { prefix: '/wiki', roles: 'all' },
];

export function getDefaultRoute(role: Role): string {
  switch (role) {
    case 'director':     return '/dashboard';
    case 'finance':      return '/financeiro';
    case 'manager':      return '/projects';
    case 'collaborator': return '/wiki';
  }
}

export function canAccess(pathname: string, role: Role): boolean {
  const sorted = [...ROUTE_PERMISSIONS].sort((a, b) => b.prefix.length - a.prefix.length);
  const match = sorted.find(r => pathname === r.prefix || pathname.startsWith(r.prefix + '/'));
  if (!match) return true;
  if (match.roles === 'all') return true;
  return (match.roles as Role[]).includes(role);
}

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  desc: string;
  roles: Role[] | 'all';
};

export type NavSection = {
  section: string;
  icon: string;
  items: NavItem[];
};

export const NAV: NavSection[] = [
  {
    section: 'Command Center',
    icon: '📊',
    items: [
      {
        href: '/dashboard',
        label: 'Visão Executiva',
        icon: '📊',
        desc: 'KPIs de receita, custo, margem e projetos em risco em tempo real.',
        roles: ['director', 'finance'],
      },
      {
        href: '/dashboard/pl',
        label: 'P&L por Conta',
        icon: '💰',
        desc: 'Demonstrativo de lucros e perdas consolidado por grupo, cliente e projeto.',
        roles: ['director', 'finance'],
      },
      {
        href: '/dashboard/billing',
        label: 'Faturamento',
        icon: '🔔',
        desc: 'Marcos de faturamento, notas pendentes e alertas de cobrança por projeto.',
        roles: ['director', 'finance'],
      },
      {
        href: '/dashboard/capacity',
        label: 'Capacity Forecast',
        icon: '🔭',
        desc: 'Projeção de ocupação da equipe com base nos projetos ativos e pipeline.',
        roles: ['director', 'manager'],
      },
      {
        href: '/dashboard/finance',
        label: 'KPIs Financeiros',
        icon: '📈',
        desc: 'Receita contratada vs realizada, fluxo de caixa, marcos vencidos e pipeline.',
        roles: ['director', 'finance'],
      },
    ],
  },
  {
    section: 'Financeiro',
    icon: '💰',
    items: [
      {
        href: '/financeiro',
        label: 'Balanço Geral',
        icon: '⚖️',
        desc: 'Posição líquida, resultado do mês e histórico de entradas e saídas.',
        roles: ['director', 'finance'],
      },
      {
        href: '/financeiro/receber',
        label: 'Contas a Receber',
        icon: '📥',
        desc: 'Gerencie recebimentos dos clientes, datas e status de cobrança.',
        roles: ['director', 'finance'],
      },
      {
        href: '/financeiro/pagar',
        label: 'Contas a Pagar',
        icon: '📤',
        desc: 'Controle pagamentos a fornecedores, despesas e obrigações.',
        roles: ['director', 'finance'],
      },
      {
        href: '/financeiro/fluxo',
        label: 'Fluxo de Caixa',
        icon: '🌊',
        desc: 'Projeção mensal de entradas, saídas e saldo acumulado.',
        roles: ['director', 'finance'],
      },
    ],
  },
  {
    section: 'Portfólio',
    icon: '📁',
    items: [
      {
        href: '/groups',
        label: 'Grupos / Contas',
        icon: '🏛️',
        desc: 'Holdings e unidades de negócio. Agrupa clientes para P&L consolidado.',
        roles: ['director', 'finance'],
      },
      {
        href: '/clients',
        label: 'Clientes',
        icon: '🏢',
        desc: 'Empresas contratantes vinculadas a um grupo para consolidação.',
        roles: ['director', 'finance', 'manager'],
      },
      {
        href: '/projects',
        label: 'Projetos',
        icon: '📁',
        desc: 'Contratos ativos com orçamento, CPI e saúde financeira.',
        roles: ['director', 'finance', 'manager'],
      },
      {
        href: '/pipeline',
        label: 'Pipeline',
        icon: '📈',
        desc: 'Oportunidades em negociação. Alimenta o Capacity Forecast.',
        roles: ['director', 'manager'],
      },
    ],
  },
  {
    section: 'Operações',
    icon: '⚙️',
    items: [
      {
        href: '/cost-entries',
        label: 'Lançar Horas',
        icon: '⬆️',
        desc: 'Importe horas do Clockify via CSV ou lance manualmente.',
        roles: ['director', 'manager'],
      },
      {
        href: '/indirect-costs',
        label: 'Custos Indiretos',
        icon: '🧾',
        desc: 'SGA rateados entre os projetos para apurar margem real.',
        roles: ['director', 'finance'],
      },
      {
        href: '/expenses',
        label: 'Despesas Extra',
        icon: '💳',
        desc: 'Licenças, viagens e outros custos diretos por projeto.',
        roles: ['director', 'finance', 'manager'],
      },
    ],
  },
  {
    section: 'Pessoas',
    icon: '👥',
    items: [
      {
        href: '/collaborators',
        label: 'Colaboradores',
        icon: '👥',
        desc: 'Equipe com custo H/H. Base do motor financeiro.',
        roles: ['director', 'finance', 'manager'],
      },
    ],
  },
  {
    section: 'Intranet',
    icon: '📚',
    items: [
      {
        href: '/wiki',
        label: 'Wiki da Equipe',
        icon: '📚',
        desc: 'Base de conhecimento: onboarding, processos e documentação técnica.',
        roles: 'all',
      },
    ],
  },
  {
    section: 'Administração',
    icon: '🔐',
    items: [
      {
        href: '/admin',
        label: 'Painel Admin',
        icon: '🔐',
        desc: 'Usuários, permissões e configurações do sistema.',
        roles: ['director'],
      },
    ],
  },
];
