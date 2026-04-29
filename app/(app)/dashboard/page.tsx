'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

/* ── Mock data (substituído por dados reais quando houver lançamentos) ── */
const MOCK_CLIENT_DATA = [
  { name: 'Tambasa', receita: 280000, custo: 198000 },
  { name: 'Zenatur', receita: 210000, custo: 175000 },
  { name: 'Eagles', receita: 190000, custo: 112000 },
  { name: 'IUNEX', receita: 155000, custo: 143000 },
  { name: 'Drive Data', receita: 130000, custo: 68000 },
];

const MOCK_BLEEDING = [
  { name: 'Projeto Modernização', client: 'Zenatur', burn: 94, progress: 58, risk: 'critical' },
  { name: 'Integração OCR', client: 'IUNEX', burn: 91, progress: 63, risk: 'critical' },
  { name: 'Migração WMS', client: 'Tambasa', burn: 87, progress: 70, risk: 'warning' },
];

/* ── Types ── */
interface ProjectPL {
  project_id: string; project_name: string; client_name: string; group_name: string;
  revenue: number; total_direct_cost: number; total_expenses: number;
  gross_margin: number; budget_cost_pct: number; billed_amount: number; pending_billing: number;
}
interface BillingAlert {
  id: string; project_name: string; client_name: string; milestone_name: string;
  amount: number; due_date: string; alert_type: string; days_overdue: number;
}

/* ── Helpers ── */
function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0);
}
function fmtK(v: number) {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
  return fmt(v);
}
function pct(v: number) { return `${(v ?? 0).toFixed(1)}%`; }

/* ── Sub-components ── */
function KpiCard({ label, value, sub, color, icon, trend }: {
  label: string; value: string; sub?: string; color: string; icon: string; trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  return (
    <div className="bg-gray-900/70 border border-white/5 rounded-2xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        {trend && <span className={`text-xs font-medium ${trendColor}`}>{trendIcon} {sub}</span>}
      </div>
      <div>
        <p className={`text-2xl font-bold ${color} tabular-nums`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}

function BurnBar({ value }: { value: number }) {
  const color = value >= 90 ? 'from-red-500 to-red-400' : value >= 75 ? 'from-yellow-500 to-amber-400' : 'from-cyan-500 to-green-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full bg-gradient-to-r ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums w-9 text-right text-gray-400">{value}%</span>
    </div>
  );
}

function AlertBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    overdue:       { label: 'Atrasado',      cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    due_soon:      { label: 'Vence em 7d',   cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    ready_to_bill: { label: 'Pronto p/ fat', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
    on_track:      { label: 'No prazo',      cls: 'bg-gray-700 text-gray-400 border-gray-600' },
  };
  const { label, cls } = map[type] ?? map.on_track;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${cls}`}>{label}</span>;
}

/* Custom Tooltip para o gráfico */
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs shadow-2xl">
      <p className="text-white font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className={p.name === 'receita' ? 'text-cyan-400' : 'text-red-400'}>
          {p.name === 'receita' ? 'Receita' : 'Custo'}: {fmtK(p.value)}
        </p>
      ))}
      {payload.length === 2 && (
        <p className="text-green-400 mt-1 border-t border-gray-700 pt-1">
          Margem: {fmtK(payload[0].value - payload[1].value)} ({((payload[0].value - payload[1].value) / payload[0].value * 100).toFixed(1)}%)
        </p>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectPL[]>([]);
  const [alerts, setAlerts] = useState<BillingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/profitability').then(r => r.json()),
      fetch('/api/dashboard/billing-alerts').then(r => r.json()),
    ]).then(([pl, ba]) => {
      const realProjects = Array.isArray(pl) ? pl : [];
      setProjects(realProjects);
      setAlerts(Array.isArray(ba) ? ba : []);
      setHasRealData(realProjects.length > 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  /* KPIs — dados reais se houver, mock caso contrário */
  const totalRevenue = hasRealData ? projects.reduce((s, p) => s + (p.revenue ?? 0), 0)     : 965000;
  const totalCost    = hasRealData ? projects.reduce((s, p) => s + (p.total_direct_cost ?? 0) + (p.total_expenses ?? 0), 0) : 696000;
  const totalMargin  = hasRealData ? projects.reduce((s, p) => s + (p.gross_margin ?? 0), 0) : 269000;
  const marginPct    = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  const atRisk       = hasRealData ? projects.filter(p => p.budget_cost_pct > 85).length : 2;
  const pendingBill  = hasRealData ? projects.reduce((s, p) => s + (p.pending_billing ?? 0), 0) : 148000;

  const chartData = hasRealData
    ? projects.slice(0, 5).map(p => ({
        name: (p.client_name ?? p.project_name ?? '').split(' ')[0],
        receita: Math.round(p.revenue ?? 0),
        custo: Math.round((p.total_direct_cost ?? 0) + (p.total_expenses ?? 0)),
      }))
    : MOCK_CLIENT_DATA;

  const bleedingProjects = hasRealData
    ? projects.filter(p => p.budget_cost_pct > 85).slice(0, 3).map(p => ({
        name: p.project_name,
        client: p.client_name ?? '—',
        burn: p.budget_cost_pct,
        progress: 100 - p.budget_cost_pct,
        risk: p.budget_cost_pct >= 90 ? 'critical' : 'warning',
      }))
    : MOCK_BLEEDING;

  const criticalAlerts = alerts.filter(a => ['overdue', 'ready_to_bill', 'due_soon'].includes(a.alert_type));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Command Center</p>
          <h1 className="text-3xl font-bold text-white">Visão Executiva</h1>
          <p className="text-gray-500 text-sm mt-1">
            {hasRealData ? `${projects.length} projetos com dados reais` : 'Visualização com dados de demonstração — lance custos para ver dados reais'}
          </p>
        </div>
        {!hasRealData && (
          <Link href="/cost-entries" className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity">
            + Lançar primeiro custo
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Receita Ativa Total" value={fmtK(totalRevenue)} icon="💵" color="text-white" trend="neutral" />
        <KpiCard label="Custo Total Realizado" value={fmtK(totalCost)} icon="📉" color="text-red-400" sub={`${pct((totalCost/totalRevenue)*100)} da receita`} trend="neutral" />
        <KpiCard label="Margem de Lucro Global" value={pct(marginPct)} icon="📈" color={marginPct >= 30 ? 'text-green-400' : marginPct >= 15 ? 'text-yellow-400' : 'text-red-400'} sub={fmtK(totalMargin)} trend={marginPct >= 25 ? 'up' : 'down'} />
        <KpiCard label="Projetos em Risco" value={String(atRisk)} icon="🚨" color={atRisk > 0 ? 'text-red-400' : 'text-green-400'} sub="burn rate > 85%" trend={atRisk > 0 ? 'down' : 'up'} />
      </div>

      {/* Corpo principal */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6">
        {/* Gráfico Receita vs Custo — 3 colunas */}
        <div className="xl:col-span-3 bg-gray-900/70 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Receita Prevista vs Custo Realizado</h2>
              <p className="text-xs text-gray-500 mt-0.5">Top 5 clientes por receita</p>
            </div>
            {!hasRealData && <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-1 rounded-full">dados demo</span>}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend formatter={(v) => <span className="text-xs text-gray-400">{v === 'receita' ? 'Receita' : 'Custo'}</span>} />
              <Bar dataKey="receita" fill="url(#gradCyan)" radius={[4,4,0,0]} name="receita" />
              <Bar dataKey="custo" fill="url(#gradRed)" radius={[4,4,0,0]} name="custo" />
              <defs>
                <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00C2E0" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#00D084" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.7} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Projetos Sangrando — 2 colunas */}
        <div className="xl:col-span-2 bg-gray-900/70 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-white">🩸 Projetos Sangrando</h2>
              <p className="text-xs text-gray-500 mt-0.5">Burn rate crítico</p>
            </div>
          </div>
          {bleedingProjects.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-600 text-sm">Nenhum projeto crítico 🎉</div>
          ) : (
            <div className="space-y-4">
              {bleedingProjects.map((p, i) => (
                <div key={i} className={`p-4 rounded-xl border ${p.risk === 'critical' ? 'bg-red-500/5 border-red-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.client}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.risk === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {p.risk === 'critical' ? '⚠ CRÍTICO' : '⚡ ATENÇÃO'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>Burn Rate</span>
                      </div>
                      <BurnBar value={p.burn} />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>Progresso</span>
                      </div>
                      <BurnBar value={p.progress} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Segunda linha — P&L tabela + Alertas de faturamento */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* P&L por projeto */}
        <div className="xl:col-span-3 bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">P&L por Projeto</h2>
            <Link href="/dashboard/pl" className="text-xs text-cyan-400 hover:underline">Ver completo →</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-600 text-xs border-b border-white/5">
                <th className="text-left px-6 py-3">Projeto</th>
                <th className="text-right px-4 py-3">Receita</th>
                <th className="text-right px-4 py-3">Margem</th>
                <th className="px-4 py-3 w-32">Budget Custo</th>
              </tr>
            </thead>
            <tbody>
              {(hasRealData ? projects : [
                { project_id: '1', project_name: 'Projeto Manobra', client_name: 'Tambasa', group_name: 'Tambasa Group', revenue: 280000, total_direct_cost: 198000, total_expenses: 0, gross_margin: 82000, budget_cost_pct: 71, billed_amount: 0, pending_billing: 0 },
                { project_id: '2', project_name: 'Modernização', client_name: 'Zenatur', group_name: 'Zenatur', revenue: 210000, total_direct_cost: 197000, total_expenses: 0, gross_margin: 13000, budget_cost_pct: 94, billed_amount: 0, pending_billing: 0 },
                { project_id: '3', project_name: 'Integração OCR', client_name: 'IUNEX', group_name: 'IUNEX', revenue: 155000, total_direct_cost: 141000, total_expenses: 0, gross_margin: 14000, budget_cost_pct: 91, billed_amount: 0, pending_billing: 0 },
                { project_id: '4', project_name: 'Portal Analytics', client_name: 'Eagles Group', group_name: 'Eagles', revenue: 190000, total_direct_cost: 112000, total_expenses: 0, gross_margin: 78000, budget_cost_pct: 59, billed_amount: 0, pending_billing: 0 },
              ]).map((p) => {
                const marginP = p.revenue > 0 ? (p.gross_margin / p.revenue) * 100 : 0;
                return (
                  <tr key={p.project_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-medium text-white text-sm">{p.project_name}</p>
                      <p className="text-xs text-gray-600">{p.client_name}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 tabular-nums text-xs">{fmtK(p.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs">
                      <span className={marginP >= 25 ? 'text-green-400' : marginP >= 10 ? 'text-yellow-400' : 'text-red-400'}>
                        {pct(marginP)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <BurnBar value={p.budget_cost_pct} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Alertas faturamento */}
        <div className="xl:col-span-2 bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">🔔 Alertas de Faturamento</h2>
            <Link href="/dashboard/billing" className="text-xs text-cyan-400 hover:underline">Ver todos →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {criticalAlerts.length === 0 ? (
              [
                { id: '1', milestone_name: 'Entrega Fase 1 — Manobra', project_name: 'Projeto Manobra', client_name: 'Tambasa', amount: 70000, due_date: '2024-01-20', alert_type: 'ready_to_bill', days_overdue: 0 },
                { id: '2', milestone_name: 'Marco de Integração WMS', project_name: 'Modernização', client_name: 'Zenatur', amount: 52000, due_date: '2024-01-15', alert_type: 'overdue', days_overdue: 5 },
                { id: '3', milestone_name: 'Go-Live OCR', project_name: 'Integração OCR', client_name: 'IUNEX', amount: 38000, due_date: '2024-01-25', alert_type: 'due_soon', days_overdue: 0 },
              ].map((a) => (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm text-white font-medium leading-tight">{a.milestone_name}</p>
                    <AlertBadge type={a.alert_type} />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{a.project_name} · {a.client_name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold text-cyan-400">{fmt(a.amount)}</p>
                    {a.days_overdue > 0 && <p className="text-xs text-red-400">{a.days_overdue}d atraso</p>}
                  </div>
                </div>
              ))
            ) : (
              criticalAlerts.slice(0, 4).map((a) => (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm text-white font-medium leading-tight">{a.milestone_name}</p>
                    <AlertBadge type={a.alert_type} />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{a.project_name} · {a.client_name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold text-cyan-400">{fmt(a.amount)}</p>
                    {a.days_overdue > 0 && <p className="text-xs text-red-400">{a.days_overdue}d atraso</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
