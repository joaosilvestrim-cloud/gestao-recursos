'use client';

import { useEffect, useState, useMemo } from 'react';

interface ProjectPL {
  project_id: string;
  project_name: string;
  status: string;
  budget_cost: number | null;
  total_direct_cost: number | null;
  total_expenses: number | null;
  progress_pct: number | null;
  cpi: number | null;
  risk_level: string | null;
  client_id: string | null;
  client_name: string | null;
  group_id: string | null;
  group_name: string | null;
}

interface GroupNode {
  id: string;
  name: string;
  clients: ClientNode[];
}

interface ClientNode {
  id: string;
  name: string;
  projects: ProjectPL[];
}

function fmt(v: number | null | undefined, decimals = 0) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function marginColor(pct: number | null) {
  if (pct == null) return 'text-gray-500';
  if (pct >= 30) return 'text-green-400';
  if (pct >= 15) return 'text-yellow-400';
  if (pct >= 0) return 'text-orange-400';
  return 'text-red-400';
}

function RiskBadge({ level, cpi }: { level: string | null; cpi: number | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    ok: { label: 'OK', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
    warning: { label: 'ATENÇÃO', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    critical: { label: 'CRÍTICO', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    bleeding: { label: 'ESTOURADO', cls: 'bg-red-900/40 text-red-300 border-red-700/50' },
  };
  const r = map[level ?? 'ok'] ?? map['ok'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${r.cls}`}>
      {r.label}
      {cpi != null && <span className="opacity-60 font-normal">CPI {cpi.toFixed(2)}</span>}
    </span>
  );
}

function SummaryBar({ budget, cost, expenses }: { budget: number | null; cost: number | null; expenses: number | null }) {
  const total = (cost ?? 0) + (expenses ?? 0);
  const pct = budget ? Math.min((total / budget) * 100, 100) : 0;
  const over = budget ? total > budget : false;
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : 'bg-cyan-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function PLPage() {
  const [projects, setProjects] = useState<ProjectPL[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [filterRisk, setFilterRisk] = useState<string>('');

  useEffect(() => {
    fetch('/api/projects?risk=1')
      .then(r => r.json())
      .then(data => {
        setProjects(Array.isArray(data) ? data : []);
        // Auto-expand everything initially
        const groups = new Set<string>();
        const clients = new Set<string>();
        (Array.isArray(data) ? data : []).forEach((p: ProjectPL) => {
          if (p.group_id) groups.add(p.group_id);
          if (p.client_id) clients.add(p.client_id);
        });
        setExpandedGroups(groups);
        setExpandedClients(clients);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!filterRisk) return projects;
    return projects.filter(p => p.risk_level === filterRisk);
  }, [projects, filterRisk]);

  const tree = useMemo(() => {
    const groupMap = new Map<string, GroupNode>();

    filtered.forEach(p => {
      const gid = p.group_id ?? '__no_group__';
      const gname = p.group_name ?? 'Sem Grupo';
      if (!groupMap.has(gid)) groupMap.set(gid, { id: gid, name: gname, clients: [] });
      const group = groupMap.get(gid)!;

      const cid = p.client_id ?? '__no_client__';
      const cname = p.client_name ?? 'Sem Cliente';
      let client = group.clients.find(c => c.id === cid);
      if (!client) {
        client = { id: cid, name: cname, projects: [] };
        group.clients.push(client);
      }
      client.projects.push(p);
    });

    return Array.from(groupMap.values());
  }, [filtered]);

  // Global KPIs
  const kpis = useMemo(() => {
    const budget = projects.reduce((s, p) => s + (p.budget_cost ?? 0), 0);
    const cost = projects.reduce((s, p) => s + (p.total_direct_cost ?? 0) + (p.total_expenses ?? 0), 0);
    const margin = budget - cost;
    const marginPct = budget ? (margin / budget) * 100 : null;
    const byRisk = { ok: 0, warning: 0, critical: 0, bleeding: 0 };
    projects.forEach(p => { if (p.risk_level) byRisk[p.risk_level as keyof typeof byRisk]++; });
    return { budget, cost, margin, marginPct, byRisk, count: projects.length };
  }, [projects]);

  function groupTotals(g: GroupNode) {
    const ps = g.clients.flatMap(c => c.projects);
    const budget = ps.reduce((s, p) => s + (p.budget_cost ?? 0), 0);
    const cost = ps.reduce((s, p) => s + (p.total_direct_cost ?? 0) + (p.total_expenses ?? 0), 0);
    const margin = budget - cost;
    const marginPct = budget ? (margin / budget) * 100 : null;
    return { budget, cost, margin, marginPct, count: ps.length };
  }

  function clientTotals(c: ClientNode) {
    const budget = c.projects.reduce((s, p) => s + (p.budget_cost ?? 0), 0);
    const cost = c.projects.reduce((s, p) => s + (p.total_direct_cost ?? 0) + (p.total_expenses ?? 0), 0);
    const margin = budget - cost;
    const marginPct = budget ? (margin / budget) * 100 : null;
    return { budget, cost, margin, marginPct };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Calculando P&L…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">💰 P&L por Conta</h1>
        <p className="text-sm text-gray-400 mt-1">
          Demonstrativo de lucros e perdas consolidado. Drill-down por grupo → cliente → projeto. Margem = Orçamento − (Custo H/H + Despesas Diretas).
        </p>
      </div>

      {/* Info box */}
      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 text-sm text-cyan-300">
        <p className="font-semibold text-cyan-200 mb-1">📖 Como ler este relatório</p>
        <ul className="text-[13px] space-y-1 text-cyan-300/80 list-disc list-inside">
          <li><strong>Orçamento:</strong> valor contratado (budget_cost do projeto)</li>
          <li><strong>Custo Realizado:</strong> horas lançadas × custo H/H + despesas extras cadastradas</li>
          <li><strong>Margem:</strong> Orçamento − Custo Realizado. Positiva = lucro, negativa = prejuízo</li>
          <li><strong>CPI:</strong> % Entregue ÷ % Orçamento Consumido. CPI &lt; 1 = custando mais do que entregando</li>
        </ul>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Orçamento Total</p>
          <p className="text-xl font-bold text-white">{fmtCurrency(kpis.budget)}</p>
          <p className="text-[11px] text-gray-600 mt-1">{kpis.count} projetos</p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Custo Realizado</p>
          <p className="text-xl font-bold text-orange-400">{fmtCurrency(kpis.cost)}</p>
          <p className="text-[11px] text-gray-600 mt-1">
            {kpis.budget ? fmt((kpis.cost / kpis.budget) * 100, 1) + '% do orçamento' : '—'}
          </p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Margem Total</p>
          <p className={`text-xl font-bold ${marginColor(kpis.marginPct)}`}>{fmtCurrency(kpis.margin)}</p>
          <p className={`text-[11px] mt-1 ${marginColor(kpis.marginPct)}`}>
            {kpis.marginPct != null ? fmt(kpis.marginPct, 1) + '%' : '—'}
          </p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-2">Projetos por Risco</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">{kpis.byRisk.ok} OK</span>
            <span className="text-[11px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">{kpis.byRisk.warning} ⚠</span>
            <span className="text-[11px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">{kpis.byRisk.critical} ✕</span>
            <span className="text-[11px] bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded">{kpis.byRisk.bleeding} 💸</span>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">Filtrar por risco:</span>
        {(['', 'ok', 'warning', 'critical', 'bleeding'] as const).map(r => (
          <button
            key={r}
            onClick={() => setFilterRisk(r)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              filterRisk === r
                ? 'bg-cyan-500 text-gray-900'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {r === '' ? 'Todos' : r === 'ok' ? '✅ OK' : r === 'warning' ? '⚠️ Atenção' : r === 'critical' ? '🔴 Crítico' : '💸 Estourado'}
          </button>
        ))}
      </div>

      {/* Tree */}
      <div className="space-y-3">
        {tree.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-3xl mb-2">📭</p>
            <p>Nenhum projeto encontrado</p>
          </div>
        )}
        {tree.map(group => {
          const gt = groupTotals(group);
          const gExpanded = expandedGroups.has(group.id);
          return (
            <div key={group.id} className="bg-gray-900 border border-white/8 rounded-xl overflow-hidden">
              {/* Group header */}
              <button
                onClick={() => setExpandedGroups(prev => {
                  const n = new Set(prev);
                  gExpanded ? n.delete(group.id) : n.add(group.id);
                  return n;
                })}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">{gExpanded ? '▼' : '▶'}</span>
                  <span className="text-lg">🏛️</span>
                  <div className="text-left">
                    <p className="text-white font-semibold">{group.name}</p>
                    <p className="text-[11px] text-gray-500">{gt.count} projeto{gt.count !== 1 ? 's' : ''} · {group.clients.length} cliente{group.clients.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-[10px] text-gray-600">Orçamento</p>
                    <p className="text-sm font-medium text-gray-300">{fmtCurrency(gt.budget)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600">Custo</p>
                    <p className="text-sm font-medium text-orange-400">{fmtCurrency(gt.cost)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600">Margem</p>
                    <p className={`text-sm font-bold ${marginColor(gt.marginPct)}`}>
                      {fmtCurrency(gt.margin)} {gt.marginPct != null ? `(${fmt(gt.marginPct, 1)}%)` : ''}
                    </p>
                  </div>
                </div>
              </button>

              {/* Clients */}
              {gExpanded && (
                <div className="border-t border-white/5">
                  {group.clients.map(client => {
                    const ct = clientTotals(client);
                    const cExpanded = expandedClients.has(client.id);
                    return (
                      <div key={client.id} className="border-b border-white/5 last:border-0">
                        {/* Client header */}
                        <button
                          onClick={() => setExpandedClients(prev => {
                            const n = new Set(prev);
                            cExpanded ? n.delete(client.id) : n.add(client.id);
                            return n;
                          })}
                          className="w-full flex items-center justify-between px-5 py-3 pl-10 hover:bg-white/3 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gray-600 text-xs">{cExpanded ? '▼' : '▶'}</span>
                            <span>🏢</span>
                            <div className="text-left">
                              <p className="text-gray-200 font-medium">{client.name}</p>
                              <p className="text-[11px] text-gray-600">{client.projects.length} projeto{client.projects.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <p className="text-[10px] text-gray-600">Orçamento</p>
                              <p className="text-xs text-gray-400">{fmtCurrency(ct.budget)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-600">Custo</p>
                              <p className="text-xs text-orange-400">{fmtCurrency(ct.cost)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-600">Margem</p>
                              <p className={`text-xs font-semibold ${marginColor(ct.marginPct)}`}>
                                {fmtCurrency(ct.margin)} {ct.marginPct != null ? `(${fmt(ct.marginPct, 1)}%)` : ''}
                              </p>
                            </div>
                          </div>
                        </button>

                        {/* Projects */}
                        {cExpanded && (
                          <div className="bg-gray-950/50">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-white/5">
                                  <th className="px-5 pl-16 py-2 text-left text-[11px] text-gray-600 font-medium">Projeto</th>
                                  <th className="px-4 py-2 text-right text-[11px] text-gray-600 font-medium">Orçamento</th>
                                  <th className="px-4 py-2 text-right text-[11px] text-gray-600 font-medium">Custo H/H</th>
                                  <th className="px-4 py-2 text-right text-[11px] text-gray-600 font-medium">Despesas</th>
                                  <th className="px-4 py-2 text-right text-[11px] text-gray-600 font-medium">Custo Total</th>
                                  <th className="px-4 py-2 text-right text-[11px] text-gray-600 font-medium">Margem</th>
                                  <th className="px-4 py-2 text-right text-[11px] text-gray-600 font-medium">% Ent.</th>
                                  <th className="px-4 py-2 text-right text-[11px] text-gray-600 font-medium">Risco</th>
                                </tr>
                              </thead>
                              <tbody>
                                {client.projects.map(p => {
                                  const totalCost = (p.total_direct_cost ?? 0) + (p.total_expenses ?? 0);
                                  const margin = (p.budget_cost ?? 0) - totalCost;
                                  const marginPct = p.budget_cost ? (margin / p.budget_cost) * 100 : null;
                                  return (
                                    <tr key={p.project_id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                                      <td className="px-5 pl-16 py-3">
                                        <div>
                                          <p className="text-gray-200">{p.project_name}</p>
                                          <SummaryBar budget={p.budget_cost} cost={p.total_direct_cost} expenses={p.total_expenses} />
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{fmtCurrency(p.budget_cost)}</td>
                                      <td className="px-4 py-3 text-right text-gray-400 tabular-nums">{fmtCurrency(p.total_direct_cost)}</td>
                                      <td className="px-4 py-3 text-right text-gray-400 tabular-nums">{fmtCurrency(p.total_expenses)}</td>
                                      <td className="px-4 py-3 text-right text-orange-400 tabular-nums font-medium">{fmtCurrency(totalCost)}</td>
                                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${marginColor(marginPct)}`}>
                                        {fmtCurrency(margin)}
                                        {marginPct != null && <span className="text-[10px] ml-1 opacity-70">({fmt(marginPct, 1)}%)</span>}
                                      </td>
                                      <td className="px-4 py-3 text-right text-gray-400 tabular-nums">
                                        {p.progress_pct != null ? fmt(p.progress_pct, 0) + '%' : '—'}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <RiskBadge level={p.risk_level} cpi={p.cpi} />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
