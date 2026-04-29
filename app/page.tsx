import Link from 'next/link';

const modules = [
  {
    href: '/projects',
    title: 'Portfólio de Projetos',
    description: 'Gerencie projetos, fases, budget e contratos',
    color: 'bg-blue-600',
    icon: '📁',
  },
  {
    href: '/collaborators',
    title: 'Recursos e Alocação',
    description: 'Equipe, skills, custo H/H e heatmap de alocação',
    color: 'bg-green-600',
    icon: '👥',
  },
  {
    href: '/timesheets',
    title: 'Time-Tracking',
    description: 'Apontamento de horas por projeto e fase',
    color: 'bg-yellow-600',
    icon: '⏱️',
  },
  {
    href: '/dashboard/financial',
    title: 'Motor Financeiro',
    description: 'Burn-rate, margens, despesas e P&L por projeto',
    color: 'bg-red-600',
    icon: '💰',
  },
  {
    href: '/dashboard',
    title: 'Dashboards & BI',
    description: 'Utilization, desvios, alertas e gargalos',
    color: 'bg-purple-600',
    icon: '📊',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Avaliação GP</h1>
          <p className="text-gray-400 text-lg">
            Sistema de Gestão de Portfólio, Recursos e Rentabilidade
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="group rounded-xl border border-gray-800 bg-gray-900 p-6 hover:border-gray-600 transition-all"
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${mod.color} mb-4 text-2xl`}>
                {mod.icon}
              </div>
              <h2 className="text-xl font-semibold mb-2 group-hover:text-white text-gray-100">
                {mod.title}
              </h2>
              <p className="text-gray-400 text-sm">{mod.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
