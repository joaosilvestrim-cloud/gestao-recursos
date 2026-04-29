'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import FieldHelp from '@/components/ui/FieldHelp';
import InfoBox from '@/components/ui/InfoBox';
import type { Client } from '@/lib/types/database';

interface ProjectRisk {
  project_id: string;
  project_name: string;
  status: string;
  progress_pct: number;
  revenue: number;
  budget_hours: number;
  budget_cost: number;
  started_at: string | null;
  estimated_end_at: string | null;
  client_id: string | null;
  client_name: string | null;
  total_hours: number;
  total_direct_cost: number;
  total_expenses: number;
  gross_margin: number;
  budget_hours_pct: number;
  budget_cost_pct: number;
  cpi: number | null;
  risk_level: 'ok' | 'warning' | 'critical' | 'bleeding';
}

const emptyForm = {
  name: '', client_id: '', description: '',
  started_at: '', estimated_end_at: '',
  contract_value: '', budget_hours: '', budget_cost: '',
  status: 'active', progress_pct: '0',
};

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0);
}

function RiskBadge({ level, cpi }: { level: string; cpi: number | null }) {
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    ok:       { label: 'Saudável',    cls: 'bg-green-500/15 text-green-400 border-green-500/30',   icon: '●' },
    warning:  { label: 'Atenção',     cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: '▲' },
    critical: { label: 'Crítico',     cls: 'bg-red-500/15 text-red-400 border-red-500/30',         icon: '⚠' },
    bleeding: { label: 'Sangramento', cls: 'bg-red-900/40 text-red-300 border-red-500/50',          icon: '🔴' },
  };
  const { label, cls, icon } = map[level] ?? map.ok;
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
        {icon} {label}
      </span>
      {cpi !== null && (
        <span className="text-[10px] text-gray-600 pl-1">CPI: {Number(cpi).toFixed(2)}</span>
      )}
    </div>
  );
}

function BurnBar({ costPct, progressPct }: { costPct: number; progressPct: number }) {
  const capped = Math.min(costPct ?? 0, 100);
  const color = capped >= 100 ? 'bg-red-600' : capped >= 90 ? 'bg-red-500' : capped >= 70 ? 'bg-yellow-500' : 'bg-gradient-to-r from-cyan-500 to-green-500';
  return (
    <div className="min-w-[120px]">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-gray-600">Custo</span>
        <span className="text-gray-400 tabular-nums">{Math.min(capped, 999).toFixed(0)}%</span>
      </div>
      <div className="relative w-full bg-gray-800 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.min(capped, 100)}%` }} />
        {progressPct > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/60 rounded-full"
            style={{ left: `${Math.min(progressPct, 100)}%` }}
            title={`${progressPct}% concluído`}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] mt-0.5">
        <span className="text-gray-700">Entregue</span>
        <span className="text-cyan-600 tabular-nums">{progressPct}%</span>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRisk[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [progressVal, setProgressVal] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  async function load() {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([fetch('/api/projects?risk=1'), fetch('/api/clients')]);
    setProjects(await pRes.json());
    setClients(await cRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditingId(null); setForm(emptyForm); setModalOpen(true); }

  function openEdit(p: ProjectRisk) {
    setEditingId(p.project_id);
    setForm({
      name: p.project_name, client_id: p.client_id ?? '', description: '',
      started_at: p.started_at ?? '', estimated_end_at: p.estimated_end_at ?? '',
      contract_value: String(p.revenue), budget_hours: String(p.budget_hours),
      budget_cost: String(p.budget_cost), status: p.status,
      progress_pct: String(p.progress_pct ?? 0),
    });
    setModalOpen(true);
  }

  function openProgress(p: ProjectRisk) {
    setEditingId(p.project_id);
    setProgressVal(Number(p.progress_pct ?? 0));
    setProgressOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = {
      name: form.name, client_id: form.client_id || null, description: form.description || null,
      started_at: form.started_at || null, estimated_end_at: form.estimated_end_at || null,
      contract_value: Number(form.contract_value) || 0, budget_hours: Number(form.budget_hours) || 0,
      budget_cost: Number(form.budget_cost) || 0, status: form.status,
      progress_pct: Number(form.progress_pct) || 0,
    };
    const url = editingId ? `/api/projects/${editingId}` : '/api/projects';
    const res = await fetch(url, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const e = await res.json(); alert(e.error); }
    setSaving(false); setModalOpen(false); load();
  }

  async function saveProgress() {
    if (!editingId) return;
    setSaving(true);
    await fetch(`/api/projects/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress_pct: progressVal }) });
    setSaving(false); setProgressOpen(false); load();
  }

  const filtered = projects.filter(p => filterStatus === 'all' || p.status === filterStatus);
  const atRisk = projects.filter(p => p.risk_level === 'critical' || p.risk_level === 'bleeding').length;
  const totalRevenue = projects.filter(p => p.status === 'active').reduce((s, p) => s + Number(p.revenue), 0);
  const totalCost = projects.filter(p => p.status === 'active').reduce((s, p) => s + Number(p.total_direct_cost) + Number(p.total_expenses), 0);

  return (
    <div className="p-8">
      <PageHeader
        title="Projetos"
        description="Portfólio de contratos — orçamento, saúde financeira e CPI calculados em tempo real"
        action={
          <button onClick={openNew} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity">
            + Novo Projeto
          </button>
        }
      />

      <InfoBox icon="📁" title="Para que serve este menu?">
        <p>
          Projetos são os <strong className="text-white">contratos fechados com seus clientes</strong>. Para cada projeto você define o
          <strong className="text-white"> valor do contrato</strong> (receita) e o <strong className="text-white">budget de custo</strong> (quanto pode gastar).
          O sistema monitora automaticamente quanto foi consumido e calcula a margem real.
        </p>
        <p className="mt-1">
          <strong className="text-white">CPI (Índice de Performance de Custo)</strong> = % entregue ÷ % orçamento consumido.
          CPI abaixo de 0.8 = alerta amarelo. Abaixo de 0.6 = crítico. A barra mostra o custo consumido; a
          linha branca indica o quanto foi entregue — se a linha estiver à esquerda da barra, o projeto está gastando mais do que entregando.
        </p>
        <p className="mt-1 text-gray-500">
          Atualize o <strong className="text-gray-400">% Concluído</strong> semanalmente (botão no hover de cada linha) para manter o CPI preciso.
        </p>
      </InfoBox>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6 mt-6">
        <div className="bg-gray-900/70 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Projetos Ativos</p>
          <p className="text-2xl font-bold text-white">{projects.filter(p => p.status === 'active').length}</p>
        </div>
        <div className="bg-gray-900/70 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Receita em Carteira</p>
          <p className="text-2xl font-bold text-green-400">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-gray-900/70 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Custo Apurado</p>
          <p className="text-2xl font-bold text-red-400">{fmt(totalCost)}</p>
        </div>
        <div className={`rounded-xl p-4 border ${atRisk > 0 ? 'bg-red-900/20 border-red-500/30' : 'bg-gray-900/70 border-white/5'}`}>
          <p className="text-xs text-gray-500 mb-1">Em Risco / Crítico</p>
          <p className={`text-2xl font-bold ${atRisk > 0 ? 'text-red-400' : 'text-gray-600'}`}>{atRisk}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        {['all', 'active', 'paused', 'completed', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}>
            {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : s === 'paused' ? 'Pausados' : s === 'completed' ? 'Concluídos' : 'Cancelados'}
            {s !== 'all' && <span className="ml-1.5 text-gray-600">{projects.filter(p => p.status === s).length}</span>}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-500 text-sm">Carregando...</p> : filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-600">
          <p className="text-5xl mb-4">📁</p>
          <p className="text-sm mb-1">Nenhum projeto cadastrado.</p>
          <button onClick={openNew} className="mt-3 text-cyan-400 text-sm hover:underline">Criar primeiro projeto</button>
        </div>
      ) : (
        <div className="bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-600 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Projeto / Cliente</th>
                <th className="text-left px-4 py-3">Risco / CPI</th>
                <th className="text-right px-4 py-3">Contrato</th>
                <th className="text-right px-4 py-3">Custo Real</th>
                <th className="text-right px-4 py-3">Margem</th>
                <th className="px-4 py-3 w-40">Burn vs Entrega</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const daysLeft = p.estimated_end_at
                  ? Math.ceil((new Date(p.estimated_end_at).getTime() - Date.now()) / 86400000)
                  : null;
                const marginPct = p.revenue > 0 ? (p.gross_margin / p.revenue) * 100 : 0;
                return (
                  <tr key={p.project_id} className={`border-b border-white/5 hover:bg-white/5 transition-colors group ${p.risk_level === 'bleeding' ? 'bg-red-900/10' : p.risk_level === 'critical' ? 'bg-red-900/5' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{p.project_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.client_name ?? <span className="italic text-gray-700">Sem cliente</span>}</p>
                      {daysLeft !== null && (
                        <p className={`text-xs mt-0.5 ${daysLeft < 0 ? 'text-red-400' : daysLeft < 14 ? 'text-yellow-400' : 'text-gray-600'}`}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d atrasado` : `${daysLeft}d restantes`}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4"><RiskBadge level={p.risk_level} cpi={p.cpi} /></td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-white font-semibold tabular-nums">{fmt(p.revenue)}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{p.budget_hours}h est.</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-red-400 font-semibold tabular-nums text-xs">{fmt(Number(p.total_direct_cost) + Number(p.total_expenses))}</p>
                      <p className="text-gray-600 text-[10px] mt-0.5">{Number(p.total_hours).toFixed(0)}h lançadas</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className={`font-bold tabular-nums ${p.gross_margin < 0 ? 'text-red-400' : marginPct < 20 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {fmt(p.gross_margin)}
                      </p>
                      <p className="text-gray-600 text-[10px] mt-0.5">{marginPct.toFixed(1)}%</p>
                    </td>
                    <td className="px-4 py-4">
                      <BurnBar costPct={Number(p.budget_cost_pct)} progressPct={Number(p.progress_pct ?? 0)} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col gap-1 items-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openProgress(p)} className="text-[10px] text-cyan-400 hover:underline whitespace-nowrap">% Entregue</button>
                        <button onClick={() => openEdit(p)} className="text-[10px] text-gray-500 hover:text-white">Editar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: % de conclusão */}
      <Modal open={progressOpen} onClose={() => setProgressOpen(false)} title="Atualizar Progresso do Projeto">
        <div className="space-y-5">
          <InfoBox icon="📐" title="O que é % Concluído?" variant="tip">
            <p>É o percentual de entregas <strong className="text-white">validadas</strong> do projeto — não o tempo gasto nem as horas consumidas.
            Base no que foi de fato entregue e aceito pelo cliente.</p>
            <p className="mt-1">Este valor alimenta o <strong className="text-white">CPI</strong>: se o projeto consumiu 70% do orçamento mas entregou 35%, o CPI é 0.50 — sinal crítico de que o projeto vai estourar o budget antes de ser concluído.</p>
            <p className="mt-1 text-gray-500">Atualize semanalmente, de preferência após cada sprint review ou marco de entrega.</p>
          </InfoBox>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-gray-400">% Concluído</label>
              <span className="text-3xl font-bold text-cyan-400">{progressVal}%</span>
            </div>
            <input type="range" min="0" max="100" step="5" value={progressVal}
              onChange={(e) => setProgressVal(Number(e.target.value))}
              className="w-full accent-cyan-500" />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0% — Não iniciado</span><span>50% — Metade</span><span>100% — Concluído</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setProgressOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm">Cancelar</button>
            <button onClick={saveProgress} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium">
              {saving ? 'Salvando...' : 'Salvar Progresso'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: criar/editar projeto */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar Projeto' : 'Novo Projeto'}>
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          <InfoBox icon="💡" title="Como funciona o Projeto no sistema" variant="tip">
            <p>Um projeto é o <strong className="text-white">&quot;balde de dinheiro&quot;</strong>: você define quanto o cliente vai pagar e quanto pode gastar para entregar. O sistema monitora automaticamente o quanto o balde está sendo consumido a cada importação de horas.</p>
          </InfoBox>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Nome do Projeto *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Modernização ERP Tambasa Q2"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
              <FieldHelp text="Nome interno do contrato. Use algo descritivo e com contexto temporal quando possível. Ex: 'Modernização ERP Tambasa Q2/2025'. Este nome aparece em todos os relatórios e na Visão Executiva." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Cliente</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="">Sem cliente vinculado</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <FieldHelp text="Empresa que contratou este projeto. Define em qual relatório de P&L (por cliente e por grupo) este projeto será consolidado. Sem cliente vinculado, o projeto fica fora dos relatórios por conta." />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descrição / Escopo</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Objetivo principal, entregas acordadas, tecnologias envolvidas..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
            <FieldHelp text="Contexto interno do projeto: objetivo, escopo acordado, principais entregas. Não é exibido para o cliente — serve para o gestor lembrar o que foi contratado ao analisar os números meses depois." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Data de Início</label>
              <input type="date" value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
              <FieldHelp text="Data em que o projeto foi oficialmente iniciado. Usada para calcular o tempo total de execução e o burn rate mensal médio." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Data de Entrega</label>
              <input type="date" value={form.estimated_end_at} onChange={(e) => setForm({ ...form, estimated_end_at: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
              <FieldHelp text="Prazo contratual de entrega. O sistema usa esta data para calcular dias restantes, disparar alertas de atraso e classificar o status de saúde do projeto." />
            </div>
          </div>

          {/* Budget block */}
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 space-y-4">
            <div>
              <p className="text-xs font-bold text-cyan-400 uppercase tracking-wide mb-1">💰 O Balde de Dinheiro</p>
              <p className="text-xs text-gray-500">Defina a receita do contrato e quanto pode gastar para entregá-lo. A diferença é a sua margem alvo.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Valor do Contrato (R$) *</label>
              <input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })}
                placeholder="100000"
                className="w-full bg-gray-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 font-semibold" />
              <FieldHelp text="Receita bruta acordada com o cliente — quanto ele vai te pagar pela entrega completa. Este é o teto do faturamento. O sistema compara todos os custos contra este valor para calcular a margem real." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Horas Estimadas</label>
                <input type="number" value={form.budget_hours} onChange={(e) => setForm({ ...form, budget_hours: e.target.value })}
                  placeholder="500"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
                <FieldHelp text="Total de horas de esforço previstas para entregar o projeto. Usado para calcular o burn rate de horas e projetar a ocupação da equipe no Capacity Forecast." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Budget de Custo (R$)</label>
                <input type="number" value={form.budget_cost} onChange={(e) => setForm({ ...form, budget_cost: e.target.value })}
                  placeholder="60000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
                <FieldHelp text="Quanto você pode gastar em custo operacional (equipe + despesas) e ainda ter lucro. Deve ser menor que o Valor do Contrato. A diferença (Contrato − Budget) é a sua margem alvo. Quando o custo real ultrapassar este valor, o risco do projeto muda para Crítico ou Sangramento." />
              </div>
            </div>

            {form.contract_value && form.budget_cost && (
              <div className="bg-gray-900/50 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">Margem alvo</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-green-400">{fmt(Number(form.contract_value) - Number(form.budget_cost))}</span>
                  <span className="text-xs text-gray-600 ml-2">({((1 - Number(form.budget_cost) / Number(form.contract_value)) * 100).toFixed(0)}%)</span>
                </div>
              </div>
            )}
          </div>

          {editingId && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                  <option value="active">Ativo — em execução</option>
                  <option value="paused">Pausado — temporariamente suspenso</option>
                  <option value="completed">Concluído — entregue</option>
                  <option value="cancelled">Cancelado — não será entregue</option>
                </select>
                <FieldHelp text="Status atual do contrato. Projetos 'Concluídos' e 'Cancelados' saem dos KPIs da Visão Executiva mas mantêm o histórico financeiro." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">% Concluído</label>
                <input type="number" min="0" max="100" value={form.progress_pct}
                  onChange={(e) => setForm({ ...form, progress_pct: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                <FieldHelp text="Percentual de entregas validadas até hoje. Alimenta o CPI. Use o botão '% Entregue' na tabela para ajustar com o slider." />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium transition-opacity">
              {saving ? 'Salvando...' : 'Salvar Projeto'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
