'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ProjectPL {
  project_id: string;
  project_name: string;
  client_name: string;
  group_name: string;
  status: string;
  revenue: number;
  total_direct_cost: number;
  total_expenses: number;
  gross_margin: number;
  budget_hours_pct: number;
  budget_cost_pct: number;
  billed_amount: number;
  pending_billing: number;
}

interface BillingAlert {
  id: string;
  project_name: string;
  client_name: string;
  milestone_name: string;
  amount: number;
  due_date: string;
  alert_type: string;
  days_overdue: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0);
}

function pct(v: number) { return `${(v ?? 0).toFixed(1)}%`; }

function BurnBar({ value, warn = 70, danger = 90 }: { value: number; warn?: number; danger?: number }) {
  const capped = Math.min(value, 100);
  const color = value >= danger ? 'from-red-500 to-red-400' : value >= warn ? 'from-yellow-500 to-amber-400' : 'from-cyan-500 to-green-400';
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full bg-gradient-to-r ${color} transition-all`} style={{ width: `${capped}%` }} />
    </div>
  );
}

function AlertBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    overdue:       { label: 'Atrasado', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' },
    due_soon:      { label: 'Vence em breve', cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
    ready_to_bill: { label: 'Pronto p/ faturar', cls: 'bg-green-500/20 text-green-400 border border-green-500/30' },
    on_track:      { label: 'No prazo', cls: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
  };
  const { label, cls } = map[type] ?? map.on_track;
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>{label}</span>;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectPL[]>([]);
  const [alerts, setAlerts] = useState<BillingAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/profitability').then(r => r.json()),
      fetch('/api/dashboard/billing-alerts').then(r => r.json()),
    ]).then(([pl, ba]) => {
      setProjects(Array.isArray(pl) ? pl : []);
      setAlerts(Array.isArray(ba) ? ba : []);
      setLoading(false);
    });
  }, []);

  const totalRevenue = projects.reduce((s, p) => s + (p.revenue ?? 0), 0);
  const totalCost    = projects.reduce((s, p) => s + (p.total_direct_cost ?? 0) + (p.total_expenses ?? 0), 0);
  const totalMargin  = projects.reduce((s, p) => s + (p.gross_margin ?? 0), 0);
  const pendingBill  = projects.reduce((s, p) => s + (p.pending_billing ?? 0), 0);
  const marginPct    = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  const criticalAlerts = alerts.filter(a => a.alert_type === 'overdue' || a.alert_type === 'ready_to_bill');

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-500 text-sm">Carregando inteligência do portfólio...</div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Command Center</p>
        <h1 className="text-3xl font-bold text-white">Visão Executiva do Portfólio</h1>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPI label="Receita Total" value={fmt(totalRevenue)} sub="contratos ativos" color="text-white" />
        <KPI label="Custo Total" value={fmt(totalCost)} sub="direto + despesas" color="text-red-400" />
        <KPI label="Margem Bruta" value={fmt(totalMargin)} sub={pct(marginPct)} color={marginPct >= 30 ? 'text-green-400' : marginPct >= 15 ? 'text-yellow-400' : 'text-red-400'} />
        <KPI label="A Faturar" value={fmt(pendingBill)} sub="milestones pendentes" color="text-cyan-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tabela P&L de Projetos */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">P&L por Projeto</h2>
            <Link href="/dashboard/pl" className="text-xs text-cyan-400 hover:underline">Ver completo →</Link>
          </div>
          <div className="bg-gray-900/60 border border-white/5 rounded-xl overflow-hidden">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm">
                Nenhum projeto com dados. <Link href="/cost-entries" className="text-cyan-400 hover:underline">Lance custos</Link> para ver a análise.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-gray-600 text-xs">
                    <th className="text-left px-5 py-3">Projeto</th>
                    <th className="text-right px-4 py-3">Receita</th>
                    <th className="text-right px-4 py-3">Custo</th>
                    <th className="text-right px-4 py-3">Margem</th>
                    <th className="px-4 py-3 w-28">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const marginP = p.revenue > 0 ? (p.gross_margin / p.revenue) * 100 : 0;
                    const totalCostP = (p.total_direct_cost ?? 0) + (p.total_expenses ?? 0);
                    return (
                      <tr key={p.project_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-white text-sm">{p.project_name}</p>
                          <p className="text-xs text-gray-500">{p.client_name ?? '—'} {p.group_name ? `· ${p.group_name}` : ''}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300 tabular-nums text-xs">{fmt(p.revenue)}</td>
                        <td className="px-4 py-3 text-right text-gray-400 tabular-nums text-xs">{fmt(totalCostP)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs">
                          <span className={marginP >= 25 ? 'text-green-400' : marginP >= 10 ? 'text-yellow-400' : 'text-red-400'}>
                            {fmt(p.gross_margin)}
                          </span>
                          <span className="text-gray-600 ml-1">({pct(marginP)})</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-500 mb-0.5">{pct(p.budget_cost_pct)} custo</p>
                          <BurnBar value={p.budget_cost_pct} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Alertas de Faturamento */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Alertas de Faturamento</h2>
            <Link href="/dashboard/billing" className="text-xs text-cyan-400 hover:underline">Ver todos →</Link>
          </div>
          <div className="space-y-3">
            {criticalAlerts.length === 0 ? (
              <div className="bg-gray-900/60 border border-white/5 rounded-xl p-6 text-center text-gray-600 text-sm">
                Nenhum alerta crítico
              </div>
            ) : (
              criticalAlerts.slice(0, 6).map((a) => (
                <div key={a.id} className="bg-gray-900/60 border border-white/5 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-white leading-tight">{a.milestone_name}</p>
                    <AlertBadge type={a.alert_type} />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{a.project_name} · {a.client_name}</p>
                  <p className="text-base font-bold text-cyan-400">{fmt(a.amount)}</p>
                  {a.days_overdue > 0 && (
                    <p className="text-xs text-red-400 mt-1">{a.days_overdue} dias em atraso</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-gray-900/60 border border-white/5 rounded-xl p-5">
      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
    </div>
  );
}
