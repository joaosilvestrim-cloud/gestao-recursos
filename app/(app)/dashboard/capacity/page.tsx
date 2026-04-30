'use client';

import { useEffect, useState, useMemo } from 'react';

interface Collaborator {
  id: string;
  name: string;
  role: string | null;
  weekly_hours: number | null;
  current_cost: { hourly_cost: number; valid_from: string; valid_until: string | null }[];
}

interface PipelineProject {
  id: string;
  name: string;
  status: string;
  probability: number | null;
  estimated_hours: number | null;
  expected_start: string | null;
  expected_end: string | null;
  client: { id: string; name: string } | null;
}

interface ActiveProject {
  project_id: string;
  project_name: string;
  status: string;
  progress_pct: number | null;
  budget_hours: number | null;
  total_hours: number | null;
  estimated_end_at: string | null;
}

function fmtHours(h: number | null) {
  if (h == null) return '—';
  return h.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + 'h';
}

function capacityColor(pct: number) {
  if (pct > 100) return 'bg-red-500';
  if (pct > 80) return 'bg-yellow-500';
  if (pct > 50) return 'bg-cyan-500';
  return 'bg-green-500';
}

function weeksUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.round(diff / (7 * 24 * 3600 * 1000)));
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function CapacityPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pipeline, setPipeline] = useState<PipelineProject[]>([]);
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [horizonWeeks, setHorizonWeeks] = useState(12);

  useEffect(() => {
    Promise.all([
      fetch('/api/collaborators').then(r => r.json()),
      fetch('/api/pipeline').then(r => r.json()),
      fetch('/api/projects?risk=1').then(r => r.json()),
    ]).then(([colabs, pipe, projs]) => {
      setCollaborators(Array.isArray(colabs) ? colabs : []);
      setPipeline(Array.isArray(pipe) ? pipe : []);
      setActiveProjects(
        (Array.isArray(projs) ? projs : []).filter((p: ActiveProject) =>
          p.status === 'active' || p.status === 'em_andamento'
        )
      );
      setLoading(false);
    });
  }, []);

  // Team total available capacity for the horizon
  const teamCapacity = useMemo(() => {
    const totalWeeklyHours = collaborators.reduce((s, c) => s + (c.weekly_hours ?? 40), 0);
    return totalWeeklyHours * horizonWeeks;
  }, [collaborators, horizonWeeks]);

  // Pipeline demand (weighted by probability)
  const pipelineDemand = useMemo(() => {
    return pipeline
      .filter(p => p.status !== 'lost' && p.status !== 'archived')
      .reduce((s, p) => {
        const prob = (p.probability ?? 50) / 100;
        const hours = p.estimated_hours ?? 0;
        return s + hours * prob;
      }, 0);
  }, [pipeline]);

  // Active project remaining hours
  const activeRemaining = useMemo(() => {
    return activeProjects.reduce((s, p) => {
      const done = (p.progress_pct ?? 0) / 100;
      const remaining = (p.budget_hours ?? 0) * (1 - done);
      return s + Math.max(0, remaining);
    }, 0);
  }, [activeProjects]);

  const totalDemand = activeRemaining + pipelineDemand;
  const utilizationPct = teamCapacity > 0 ? (totalDemand / teamCapacity) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Calculando capacity…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🔭 Capacity Forecast</h1>
        <p className="text-sm text-gray-400 mt-1">
          Projeção de ocupação da equipe: horas disponíveis vs demanda de projetos ativos + pipeline ponderado. Identifique gargalos antes que virem problema.
        </p>
      </div>

      {/* Info box */}
      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 text-sm text-cyan-300">
        <p className="font-semibold text-cyan-200 mb-1">📖 Como interpretar este painel</p>
        <ul className="text-[13px] space-y-1 text-cyan-300/80 list-disc list-inside">
          <li><strong>Capacidade disponível:</strong> soma das horas semanais de cada colaborador ativo × horizonte</li>
          <li><strong>Demanda ativa:</strong> horas restantes nos projetos em andamento (orçamento × (1 − % entregue))</li>
          <li><strong>Demanda pipeline:</strong> horas estimadas de cada oportunidade × probabilidade de conversão</li>
          <li><strong>Utilização &gt; 100%:</strong> equipe sobrecarregada — hora de contratar, priorizar ou recusar novos projetos</li>
          <li><strong>Dica:</strong> cadastre as horas estimadas no Pipeline e as horas semanais nos Colaboradores para maximizar a precisão</li>
        </ul>
      </div>

      {/* Horizon selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">Horizonte de análise:</span>
        {[4, 8, 12, 24, 52].map(w => (
          <button
            key={w}
            onClick={() => setHorizonWeeks(w)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              horizonWeeks === w ? 'bg-cyan-500 text-gray-900' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {w < 52 ? `${w} sem.` : '1 ano'}
          </button>
        ))}
        <span className="text-[11px] text-gray-600">({horizonWeeks * 5} dias úteis)</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Capacidade Total</p>
          <p className="text-xl font-bold text-white">{fmtHours(teamCapacity)}</p>
          <p className="text-[11px] text-gray-600 mt-1">{collaborators.length} colaboradores × {horizonWeeks} semanas</p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Demanda Ativa</p>
          <p className="text-xl font-bold text-orange-400">{fmtHours(activeRemaining)}</p>
          <p className="text-[11px] text-gray-600 mt-1">{activeProjects.length} projetos em andamento</p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Demanda Pipeline</p>
          <p className="text-xl font-bold text-yellow-400">{fmtHours(Math.round(pipelineDemand))}</p>
          <p className="text-[11px] text-gray-600 mt-1">{pipeline.filter(p => p.status !== 'lost').length} oportunidades (ponderado)</p>
        </div>
        <div className={`border rounded-xl p-4 ${utilizationPct > 100 ? 'bg-red-900/20 border-red-500/30' : utilizationPct > 80 ? 'bg-yellow-900/10 border-yellow-500/20' : 'bg-gray-900 border-white/5'}`}>
          <p className="text-xs text-gray-500 mb-1">Utilização Estimada</p>
          <p className={`text-xl font-bold ${utilizationPct > 100 ? 'text-red-400' : utilizationPct > 80 ? 'text-yellow-400' : 'text-green-400'}`}>
            {utilizationPct.toFixed(0)}%
          </p>
          <p className="text-[11px] text-gray-600 mt-1">
            {utilizationPct > 100 ? '⚠️ Equipe sobrecarregada' : utilizationPct > 80 ? '⚡ Capacidade alta' : '✅ Capacidade adequada'}
          </p>
        </div>
      </div>

      {/* Master utilization bar */}
      <div className="bg-gray-900 border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Ocupação Total da Equipe</p>
          <p className="text-sm text-gray-400">
            {fmtHours(Math.round(totalDemand))} de {fmtHours(teamCapacity)} disponíveis
          </p>
        </div>
        <div className="h-5 bg-white/10 rounded-full overflow-hidden">
          {/* Active portion */}
          <div
            className="h-full float-left bg-orange-500 transition-all"
            style={{ width: `${Math.min((activeRemaining / teamCapacity) * 100, 100)}%` }}
          />
          {/* Pipeline portion */}
          <div
            className="h-full float-left bg-yellow-500/60 transition-all"
            style={{ width: `${Math.min((pipelineDemand / teamCapacity) * 100, Math.max(0, 100 - (activeRemaining / teamCapacity) * 100))}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Projetos Ativos</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500/60 inline-block" /> Pipeline (ponderado)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/10 inline-block" /> Capacidade livre</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team capacity breakdown */}
        <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-sm font-semibold text-white">👥 Colaboradores — Capacidade Individual</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Horas disponíveis por pessoa no horizonte selecionado. Configure as horas semanais no cadastro de colaboradores.</p>
          </div>
          <div className="divide-y divide-white/5">
            {collaborators.length === 0 && (
              <p className="px-5 py-8 text-center text-gray-600 text-sm">Nenhum colaborador ativo cadastrado.</p>
            )}
            {collaborators.map(c => {
              const weeklyH = c.weekly_hours ?? 40;
              const totalH = weeklyH * horizonWeeks;
              const cost = c.current_cost?.find(x => !x.valid_until)?.hourly_cost ?? null;
              return (
                <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-xs font-bold text-cyan-300">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{c.name}</p>
                    <p className="text-[11px] text-gray-600">{c.role ?? 'Sem função'} · {weeklyH}h/sem</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">{fmtHours(totalH)}</p>
                    {cost && <p className="text-[11px] text-gray-600">R$ {cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/h</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {collaborators.length > 0 && (
            <div className="px-5 py-3 border-t border-white/5 flex justify-between">
              <span className="text-xs text-gray-500">Total da equipe</span>
              <span className="text-sm font-bold text-white">{fmtHours(teamCapacity)}</span>
            </div>
          )}
        </div>

        {/* Pipeline demand */}
        <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-sm font-semibold text-white">📈 Pipeline — Demanda Futura</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Horas estimadas × probabilidade de conversão. Projetos perdidos são excluídos. Cadastre horas estimadas no Pipeline.</p>
          </div>
          <div className="divide-y divide-white/5">
            {pipeline.filter(p => p.status !== 'lost' && p.status !== 'archived').length === 0 && (
              <p className="px-5 py-8 text-center text-gray-600 text-sm">Nenhuma oportunidade ativa no pipeline.</p>
            )}
            {pipeline
              .filter(p => p.status !== 'lost' && p.status !== 'archived')
              .map(p => {
                const prob = p.probability ?? 50;
                const est = p.estimated_hours ?? 0;
                const weighted = Math.round(est * prob / 100);
                const probColor = prob >= 75 ? 'text-green-400' : prob >= 50 ? 'text-yellow-400' : 'text-orange-400';
                const weeksLeft = weeksUntil(p.expected_start);
                return (
                  <div key={p.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-200 truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-600">{p.client?.name ?? '—'} · Início: {fmtDate(p.expected_start)}</p>
                        {weeksLeft != null && weeksLeft <= horizonWeeks && (
                          <p className="text-[11px] text-cyan-400/70">⚡ Começa em ~{weeksLeft} sem.</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-white">{fmtHours(weighted)}</p>
                        <p className={`text-[11px] ${probColor}`}>{prob}% prob. · {fmtHours(est)} bruto</p>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${prob >= 75 ? 'bg-green-500' : prob >= 50 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                        style={{ width: `${prob}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          {pipeline.filter(p => p.status !== 'lost').length > 0 && (
            <div className="px-5 py-3 border-t border-white/5 flex justify-between">
              <span className="text-xs text-gray-500">Demanda ponderada</span>
              <span className="text-sm font-bold text-yellow-400">{fmtHours(Math.round(pipelineDemand))}</span>
            </div>
          )}
        </div>
      </div>

      {/* Active projects remaining */}
      {activeProjects.length > 0 && (
        <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-sm font-semibold text-white">📁 Projetos Ativos — Horas Restantes</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Cálculo: orçamento de horas × (1 − % entregue). Cadastre o "% Entregue" nos projetos para precisão.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-white/5">
              <tr>
                <th className="px-5 py-2 text-left text-[11px] text-gray-500 font-medium">Projeto</th>
                <th className="px-4 py-2 text-right text-[11px] text-gray-500 font-medium">H Orçadas</th>
                <th className="px-4 py-2 text-right text-[11px] text-gray-500 font-medium">% Entregue</th>
                <th className="px-4 py-2 text-right text-[11px] text-gray-500 font-medium">H Restantes</th>
                <th className="px-4 py-2 text-center text-[11px] text-gray-500 font-medium">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {activeProjects.map(p => {
                const done = (p.progress_pct ?? 0) / 100;
                const remaining = Math.max(0, (p.budget_hours ?? 0) * (1 - done));
                return (
                  <tr key={p.project_id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3 text-gray-200">{p.project_name}</td>
                    <td className="px-4 py-3 text-right text-gray-400 tabular-nums">{fmtHours(p.budget_hours)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={`text-xs font-medium ${done >= 0.8 ? 'text-green-400' : done >= 0.5 ? 'text-yellow-400' : 'text-orange-400'}`}>
                        {((p.progress_pct ?? 0)).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-orange-400 tabular-nums font-semibold">{fmtHours(Math.round(remaining))}</td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">{fmtDate(p.estimated_end_at)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-white/10">
              <tr>
                <td className="px-5 py-3 text-xs text-gray-500 font-medium">Total</td>
                <td className="px-4 py-3 text-right text-gray-400 text-xs tabular-nums">
                  {fmtHours(activeProjects.reduce((s, p) => s + (p.budget_hours ?? 0), 0))}
                </td>
                <td />
                <td className="px-4 py-3 text-right text-orange-400 text-xs font-bold tabular-nums">
                  {fmtHours(Math.round(activeRemaining))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Alert if overloaded */}
      {utilizationPct > 100 && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="text-red-300 font-semibold">Capacidade Excedida em {(utilizationPct - 100).toFixed(0)}%</p>
            <p className="text-red-400/70 text-sm mt-1">
              A demanda total ({fmtHours(Math.round(totalDemand))}) supera a capacidade disponível ({fmtHours(teamCapacity)}) no horizonte de {horizonWeeks} semanas.
              Considere: aumentar o time, redistribuir projetos, renegociar prazos ou reduzir o pipeline.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
