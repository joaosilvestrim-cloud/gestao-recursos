'use client';

import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  amount: number;
  due_date: string | null;
  status: 'pending' | 'achieved' | 'billed';
  billed_at: string | null;
  achieved_at: string | null;
  project: { id: string; name: string; client: { id: string; name: string } | null } | null;
}

interface ProjectPL {
  project_id: string;
  project_name: string;
  status: string;
  budget_cost: number | null;
  total_direct_cost: number | null;
  total_expenses: number | null;
  client_name: string | null;
  group_name: string | null;
}

interface PipelineProject {
  id: string;
  name: string;
  status: string;
  probability: number | null;
  expected_revenue: number | null;
  expected_close_date: string | null;
  client: { name: string } | null;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtCurrency(v: number | null) {
  if (v == null) return '—';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function isOverdue(due: string | null, status: string) {
  if (!due || status === 'billed') return false;
  return new Date(due) < new Date();
}

function KpiCard({ label, value, sub, color = 'white', icon }: {
  label: string; value: string; sub?: string; color?: string; icon: string;
}) {
  const colorClass = color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' :
    color === 'yellow' ? 'text-yellow-400' : color === 'cyan' ? 'text-cyan-400' :
    color === 'orange' ? 'text-orange-400' : 'text-white';
  return (
    <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

export default function FinancePage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projects, setProjects] = useState<ProjectPL[]>([]);
  const [pipeline, setPipeline] = useState<PipelineProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(12); // last N months

  useEffect(() => {
    Promise.all([
      fetch('/api/billing-milestones').then(r => r.json()),
      fetch('/api/projects?risk=1').then(r => r.json()),
      fetch('/api/pipeline').then(r => r.json()),
    ]).then(([ms, ps, pipe]) => {
      setMilestones(Array.isArray(ms) ? ms : []);
      setProjects(Array.isArray(ps) ? ps : []);
      setPipeline(Array.isArray(pipe) ? pipe : []);
      setLoading(false);
    });
  }, []);

  // ── KPIs ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalContracted = milestones.reduce((s, m) => s + m.amount, 0);
    const totalBilled = milestones.filter(m => m.status === 'billed').reduce((s, m) => s + m.amount, 0);
    const totalAchieved = milestones.filter(m => m.status === 'achieved').reduce((s, m) => s + m.amount, 0);
    const totalPending = milestones.filter(m => m.status === 'pending').reduce((s, m) => s + m.amount, 0);
    const overdue = milestones.filter(m => isOverdue(m.due_date, m.status));
    const overdueAmount = overdue.reduce((s, m) => s + m.amount, 0);
    const billingRate = totalContracted > 0 ? (totalBilled / totalContracted) * 100 : 0;

    // Pipeline weighted
    const pipelineRevenue = pipeline
      .filter(p => p.status !== 'lost' && p.status !== 'archived')
      .reduce((s, p) => s + ((p.expected_revenue ?? 0) * ((p.probability ?? 50) / 100)), 0);

    // Avg per project
    const billedProjectCount = new Set(milestones.filter(m => m.status === 'billed').map(m => m.project_id)).size;
    const avgPerProject = billedProjectCount > 0 ? totalBilled / billedProjectCount : 0;

    // Portfolio margin
    const portfolioBudget = projects.reduce((s, p) => s + (p.budget_cost ?? 0), 0);
    const portfolioCost = projects.reduce((s, p) => s + (p.total_direct_cost ?? 0) + (p.total_expenses ?? 0), 0);
    const portfolioMargin = portfolioBudget - portfolioCost;
    const portfolioMarginPct = portfolioBudget > 0 ? (portfolioMargin / portfolioBudget) * 100 : 0;

    return {
      totalContracted, totalBilled, totalAchieved, totalPending,
      overdueAmount, overdueCount: overdue.length, billingRate,
      pipelineRevenue, avgPerProject,
      portfolioBudget, portfolioCost, portfolioMargin, portfolioMarginPct,
    };
  }, [milestones, projects, pipeline]);

  // ── Monthly billing chart ──────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();

    // Init last N months with 0
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, 0);
    }

    milestones
      .filter(m => m.status === 'billed' && m.billed_at)
      .forEach(m => {
        const key = m.billed_at!.slice(0, 7);
        if (map.has(key)) map.set(key, (map.get(key) ?? 0) + m.amount);
      });

    return Array.from(map.entries()).map(([key, value]) => {
      const [y, mo] = key.split('-');
      return { month: `${MONTH_NAMES[parseInt(mo) - 1]}/${y.slice(2)}`, value };
    });
  }, [milestones, period]);

  // ── Top projects by revenue ────────────────────────────────────
  const topProjects = useMemo(() => {
    const map = new Map<string, { name: string; client: string; billed: number; pending: number }>();
    milestones.forEach(m => {
      const key = m.project_id;
      if (!map.has(key)) map.set(key, {
        name: m.project?.name ?? '—',
        client: m.project?.client?.name ?? '—',
        billed: 0, pending: 0,
      });
      const entry = map.get(key)!;
      if (m.status === 'billed') entry.billed += m.amount;
      else entry.pending += m.amount;
    });
    return Array.from(map.values()).sort((a, b) => (b.billed + b.pending) - (a.billed + a.pending)).slice(0, 8);
  }, [milestones]);

  // ── Upcoming milestones ────────────────────────────────────────
  const upcoming = useMemo(() => {
    return milestones
      .filter(m => m.status !== 'billed' && m.due_date)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 10);
  }, [milestones]);

  const customTooltipStyle = {
    backgroundColor: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '12px',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Calculando KPIs financeiros…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">📈 KPIs Financeiros — Fluxo de Caixa</h1>
        <p className="text-sm text-gray-400 mt-1">
          Receita contratada, realizada e projetada. Rastreamento de marcos, inadimplência e pipeline de receita futura.
        </p>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">Período do gráfico:</span>
        {[3, 6, 12, 24].map(m => (
          <button key={m} onClick={() => setPeriod(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              period === m ? 'bg-cyan-500 text-gray-900' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {m < 12 ? `${m} meses` : m === 12 ? '12 meses' : '2 anos'}
          </button>
        ))}
      </div>

      {/* KPI Row 1 — Receita */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">💵 Receita por Status</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon="📋" label="Total Contratado" value={fmtCurrency(kpis.totalContracted)} sub={`${milestones.length} marcos no total`} color="white" />
          <KpiCard icon="💵" label="Já Faturado" value={fmtCurrency(kpis.totalBilled)} sub={`${kpis.billingRate.toFixed(0)}% do contratado`} color="green" />
          <KpiCard icon="✅" label="Atingido (NF pendente)" value={fmtCurrency(kpis.totalAchieved)} sub="entregue, ainda não faturado" color="cyan" />
          <KpiCard icon="⏳" label="Pendente" value={fmtCurrency(kpis.totalPending)} sub="aguardando entrega" color="yellow" />
        </div>
      </div>

      {/* KPI Row 2 — Saúde */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">🏥 Saúde Financeira</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon="🔴" label="Marcos Vencidos" value={`${kpis.overdueCount} marcos`} sub={fmtCurrency(kpis.overdueAmount) + ' em risco'} color={kpis.overdueCount > 0 ? 'red' : 'green'} />
          <KpiCard icon="📊" label="Margem do Portfólio" value={`${kpis.portfolioMarginPct.toFixed(1)}%`} sub={fmtCurrency(kpis.portfolioMargin)} color={kpis.portfolioMarginPct >= 20 ? 'green' : kpis.portfolioMarginPct >= 0 ? 'yellow' : 'red'} />
          <KpiCard icon="🎯" label="Ticket Médio / Projeto" value={fmtCurrency(kpis.avgPerProject)} sub="receita faturada por projeto" color="white" />
          <KpiCard icon="🔭" label="Pipeline de Receita" value={fmtCurrency(Math.round(kpis.pipelineRevenue))} sub="oportunidades ponderadas" color="cyan" />
        </div>
      </div>

      {/* Billing rate progress bar */}
      <div className="bg-gray-900 border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Taxa de Realização de Receita</p>
          <p className="text-sm text-gray-400">{fmtCurrency(kpis.totalBilled)} faturado de {fmtCurrency(kpis.totalContracted)} contratado</p>
        </div>
        <div className="h-4 bg-white/10 rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(kpis.billingRate, 100)}%` }} />
          {kpis.totalAchieved > 0 && kpis.totalContracted > 0 && (
            <div className="h-full bg-cyan-500/50 transition-all"
              style={{ width: `${Math.min((kpis.totalAchieved / kpis.totalContracted) * 100, 100 - kpis.billingRate)}%` }} />
          )}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Faturado ({kpis.billingRate.toFixed(0)}%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500/50 inline-block" /> Atingido (NF pendente)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/10 inline-block" /> Pendente</span>
        </div>
      </div>

      {/* Monthly chart */}
      <div className="bg-gray-900 border border-white/5 rounded-xl p-5">
        <p className="text-sm font-semibold text-white mb-4">📅 Faturamento Mensal (R$)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip
              contentStyle={customTooltipStyle}
              formatter={(v) => [fmtCurrency(typeof v === 'number' ? v : null), 'Faturado']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {monthlyData.map((entry, i) => (
                <Cell key={i} fill={entry.value > 0 ? '#06b6d4' : 'rgba(255,255,255,0.05)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top projects */}
        <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-sm font-semibold text-white">🏆 Top Projetos por Receita</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Ordenado por receita total (faturado + pendente)</p>
          </div>
          <div className="divide-y divide-white/5">
            {topProjects.length === 0 && (
              <p className="px-5 py-8 text-center text-gray-600 text-sm">Nenhum marco cadastrado.</p>
            )}
            {topProjects.map((p, i) => {
              const total = p.billed + p.pending;
              const billedPct = total > 0 ? (p.billed / total) * 100 : 0;
              return (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="text-sm text-gray-200 font-medium">{p.name}</p>
                      <p className="text-[11px] text-gray-600">{p.client}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{fmtCurrency(total)}</p>
                      <p className="text-[11px] text-green-400">{fmtCurrency(p.billed)} faturado</p>
                    </div>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${billedPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming milestones */}
        <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-sm font-semibold text-white">⏰ Próximos Marcos a Faturar</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Ordenados por vencimento. Vermelho = vencido.</p>
          </div>
          <div className="divide-y divide-white/5">
            {upcoming.length === 0 && (
              <p className="px-5 py-8 text-center text-gray-600 text-sm">Sem marcos pendentes.</p>
            )}
            {upcoming.map(m => {
              const overdue = isOverdue(m.due_date, m.status);
              const daysLeft = m.due_date ? Math.ceil((new Date(m.due_date).getTime() - Date.now()) / 86400000) : null;
              return (
                <div key={m.id} className={`px-5 py-3 flex items-center justify-between gap-3 ${overdue ? 'bg-red-900/10' : ''}`}>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${overdue ? 'text-red-300' : 'text-gray-200'}`}>{m.name}</p>
                    <p className="text-[11px] text-gray-600 truncate">{m.project?.name} · {m.project?.client?.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">{fmtCurrency(m.amount)}</p>
                    <p className={`text-[11px] ${overdue ? 'text-red-400' : daysLeft != null && daysLeft <= 7 ? 'text-yellow-400' : 'text-gray-600'}`}>
                      {overdue ? `⚠ ${Math.abs(daysLeft!)}d vencido` : daysLeft != null ? `${daysLeft}d` : fmtDate(m.due_date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pipeline preview */}
      {pipeline.filter(p => p.status !== 'lost' && p.expected_revenue).length > 0 && (
        <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-sm font-semibold text-white">🔭 Pipeline — Receita Futura Projetada</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Oportunidades ponderadas por probabilidade de conversão</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-white/5">
              <tr>
                <th className="px-5 py-2 text-left text-[11px] text-gray-500 font-medium">Oportunidade</th>
                <th className="px-4 py-2 text-right text-[11px] text-gray-500 font-medium">Receita Bruta</th>
                <th className="px-4 py-2 text-center text-[11px] text-gray-500 font-medium">Probabilidade</th>
                <th className="px-4 py-2 text-right text-[11px] text-gray-500 font-medium">Receita Ponderada</th>
                <th className="px-4 py-2 text-center text-[11px] text-gray-500 font-medium">Previsão Fechamento</th>
              </tr>
            </thead>
            <tbody>
              {pipeline
                .filter(p => p.status !== 'lost' && p.status !== 'archived' && p.expected_revenue)
                .sort((a, b) => ((b.expected_revenue ?? 0) * ((b.probability ?? 50) / 100)) - ((a.expected_revenue ?? 0) * ((a.probability ?? 50) / 100)))
                .slice(0, 8)
                .map(p => {
                  const prob = p.probability ?? 50;
                  const weighted = (p.expected_revenue ?? 0) * (prob / 100);
                  return (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-gray-200">{p.name}</p>
                        <p className="text-[11px] text-gray-600">{p.client?.name ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 tabular-nums">{fmtCurrency(p.expected_revenue)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold ${prob >= 75 ? 'text-green-400' : prob >= 50 ? 'text-yellow-400' : 'text-orange-400'}`}>{prob}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-cyan-400 font-semibold tabular-nums">{fmtCurrency(Math.round(weighted))}</td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs">{fmtDate(p.expected_close_date)}</td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot className="border-t border-white/10">
              <tr>
                <td colSpan={3} className="px-5 py-3 text-xs text-gray-500">Total ponderado</td>
                <td className="px-4 py-3 text-right text-cyan-400 font-bold tabular-nums text-sm">{fmtCurrency(Math.round(kpis.pipelineRevenue))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
