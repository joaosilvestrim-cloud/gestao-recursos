'use client';

import { useEffect, useState, useMemo } from 'react';

interface BillingMilestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  triggered_by: string | null;
  status: 'pending' | 'achieved' | 'billed';
  achieved_at: string | null;
  billed_at: string | null;
  project: {
    id: string;
    name: string;
    client: { id: string; name: string } | null;
  } | null;
}

interface Project {
  id: string;
  name: string;
  client_name?: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pendente', icon: '⏳', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  achieved: { label: 'Atingido', icon: '✅', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  billed: { label: 'Faturado', icon: '💵', cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtCurrency(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function isOverdue(due: string | null, status: string) {
  if (!due || status === 'billed') return false;
  return new Date(due) < new Date();
}

const EMPTY_FORM = {
  project_id: '',
  name: '',
  description: '',
  amount: '',
  due_date: '',
  triggered_by: '',
  status: 'pending' as const,
};

export default function BillingPage() {
  const [milestones, setMilestones] = useState<BillingMilestone[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BillingMilestone | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [ms, ps] = await Promise.all([
      fetch('/api/billing-milestones').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]);
    setMilestones(Array.isArray(ms) ? ms : []);
    setProjects(Array.isArray(ps) ? ps : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return milestones.filter(m => {
      if (filterStatus && m.status !== filterStatus) return false;
      if (filterProject && m.project_id !== filterProject) return false;
      return true;
    });
  }, [milestones, filterStatus, filterProject]);

  // KPIs
  const kpis = useMemo(() => {
    const total = milestones.reduce((s, m) => s + m.amount, 0);
    const billed = milestones.filter(m => m.status === 'billed').reduce((s, m) => s + m.amount, 0);
    const achieved = milestones.filter(m => m.status === 'achieved').reduce((s, m) => s + m.amount, 0);
    const pending = milestones.filter(m => m.status === 'pending').reduce((s, m) => s + m.amount, 0);
    const overdue = milestones.filter(m => isOverdue(m.due_date, m.status)).length;
    return { total, billed, achieved, pending, overdue };
  }, [milestones]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(m: BillingMilestone) {
    setEditing(m);
    setForm({
      project_id: m.project_id,
      name: m.name,
      description: m.description ?? '',
      amount: String(m.amount),
      due_date: m.due_date ?? '',
      triggered_by: m.triggered_by ?? '',
      status: m.status,
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.project_id || !form.name || !form.amount) return;
    setSaving(true);
    const body = {
      project_id: form.project_id,
      name: form.name,
      description: form.description || null,
      amount: parseFloat(form.amount),
      due_date: form.due_date || null,
      triggered_by: form.triggered_by || null,
      status: form.status,
    };
    if (editing) {
      await fetch(`/api/billing-milestones/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch('/api/billing-milestones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setSaving(false);
    setShowModal(false);
    load();
  }

  async function advanceStatus(m: BillingMilestone) {
    const next = m.status === 'pending' ? 'achieved' : 'billed';
    await fetch(`/api/billing-milestones/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  async function del(id: string) {
    if (!confirm('Excluir este marco de faturamento?')) return;
    await fetch(`/api/billing-milestones/${id}`, { method: 'DELETE' });
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Carregando faturamento…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🔔 Faturamento</h1>
          <p className="text-sm text-gray-400 mt-1">
            Marcos de cobrança por projeto. Gerencie o fluxo: Pendente → Atingido → Faturado. Configure alertas de vencimento para não perder receita.
          </p>
        </div>
        <button
          onClick={openNew}
          className="shrink-0 bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + Novo Marco
        </button>
      </div>

      {/* Info box */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-300">
        <p className="font-semibold text-yellow-200 mb-1">📖 Como usar os Marcos de Faturamento</p>
        <ul className="text-[13px] space-y-1 text-yellow-300/80 list-disc list-inside">
          <li><strong>Marco:</strong> cada entrega ou evento que gera direito de cobrança (ex: "Entrega do módulo 1", "30 dias de vigência")</li>
          <li><strong>Pendente → Atingido:</strong> clique em "Avançar" quando a entrega ocorrer. Sistema registra a data automaticamente</li>
          <li><strong>Atingido → Faturado:</strong> clique em "Avançar" ao emitir a nota fiscal. Data de faturamento é registrada</li>
          <li><strong>Disparado por:</strong> descreva o gatilho (ex: "aprovação do cliente", "data fixa", "conclusão da fase 2")</li>
        </ul>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Contratado</p>
          <p className="text-lg font-bold text-white">{fmtCurrency(kpis.total)}</p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Já Faturado</p>
          <p className="text-lg font-bold text-green-400">{fmtCurrency(kpis.billed)}</p>
          <p className="text-[11px] text-gray-600 mt-1">{milestones.filter(m => m.status === 'billed').length} marcos</p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Atingido (a faturar)</p>
          <p className="text-lg font-bold text-blue-400">{fmtCurrency(kpis.achieved)}</p>
          <p className="text-[11px] text-gray-600 mt-1">{milestones.filter(m => m.status === 'achieved').length} marcos</p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Pendente</p>
          <p className="text-lg font-bold text-yellow-400">{fmtCurrency(kpis.pending)}</p>
          <p className="text-[11px] text-gray-600 mt-1">{milestones.filter(m => m.status === 'pending').length} marcos</p>
        </div>
        <div className={`border rounded-xl p-4 ${kpis.overdue > 0 ? 'bg-red-900/20 border-red-500/30' : 'bg-gray-900 border-white/5'}`}>
          <p className="text-xs text-gray-500 mb-1">Vencidos</p>
          <p className={`text-lg font-bold ${kpis.overdue > 0 ? 'text-red-400' : 'text-gray-500'}`}>{kpis.overdue}</p>
          <p className="text-[11px] text-gray-600 mt-1">não faturados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="">Todos os status</option>
          <option value="pending">⏳ Pendente</option>
          <option value="achieved">✅ Atingido</option>
          <option value="billed">💵 Faturado</option>
        </select>
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="">Todos os projetos</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {(filterStatus || filterProject) && (
          <button onClick={() => { setFilterStatus(''); setFilterProject(''); }} className="text-xs text-gray-500 hover:text-gray-300 underline">
            limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] text-gray-500 font-medium">Marco</th>
              <th className="px-4 py-3 text-left text-[11px] text-gray-500 font-medium">Projeto / Cliente</th>
              <th className="px-4 py-3 text-right text-[11px] text-gray-500 font-medium">Valor</th>
              <th className="px-4 py-3 text-center text-[11px] text-gray-500 font-medium">Vencimento</th>
              <th className="px-4 py-3 text-center text-[11px] text-gray-500 font-medium">Status</th>
              <th className="px-4 py-3 text-center text-[11px] text-gray-500 font-medium">Datas</th>
              <th className="px-4 py-3 text-right text-[11px] text-gray-500 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-600">
                  Nenhum marco encontrado. Clique em "+ Novo Marco" para criar.
                </td>
              </tr>
            )}
            {filtered.map(m => {
              const overdue = isOverdue(m.due_date, m.status);
              const sc = STATUS_CONFIG[m.status];
              return (
                <tr key={m.id} className={`border-b border-white/5 hover:bg-white/2 transition-colors ${overdue ? 'bg-red-900/5' : ''}`}>
                  <td className="px-5 py-3">
                    <p className="text-gray-200 font-medium">{m.name}</p>
                    {m.triggered_by && <p className="text-[11px] text-gray-600">Gatilho: {m.triggered_by}</p>}
                    {m.description && <p className="text-[11px] text-gray-600 truncate max-w-[200px]">{m.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-300">{m.project?.name ?? '—'}</p>
                    <p className="text-[11px] text-gray-600">{m.project?.client?.name ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{fmtCurrency(m.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    {overdue ? (
                      <span className="text-red-400 text-xs font-semibold">🔴 {fmtDate(m.due_date)}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">{fmtDate(m.due_date)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium ${sc.cls}`}>
                      {sc.icon} {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.achieved_at && <p className="text-[10px] text-gray-600">✅ {fmtDate(m.achieved_at)}</p>}
                    {m.billed_at && <p className="text-[10px] text-gray-600">💵 {fmtDate(m.billed_at)}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {m.status !== 'billed' && (
                        <button
                          onClick={() => advanceStatus(m)}
                          className="px-2 py-1 text-[11px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded transition-colors"
                        >
                          Avançar →
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(m)}
                        className="px-2 py-1 text-[11px] bg-white/5 hover:bg-white/10 text-gray-400 rounded transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => del(m.id)}
                        className="px-2 py-1 text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Editar Marco' : 'Novo Marco de Faturamento'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
                Um marco de faturamento é um evento contratual que gera direito de emitir nota fiscal. Exemplos: entrega de fase, relatório mensal, milestone de aprovação.
              </div>

              {/* Project */}
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Projeto <span className="text-red-400">*</span></label>
                <select
                  value={form.project_id}
                  onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Selecione o projeto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p className="text-[11px] text-gray-600 mt-1">O projeto ao qual este marco pertence. Determina qual contrato será faturado.</p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Nome do Marco <span className="text-red-400">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Entrega Fase 1 — Diagnóstico"
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-gray-600 mt-1">Nome claro que identifique a entrega ou evento. Aparecerá nos relatórios e na fila de cobrança.</p>
              </div>

              {/* Amount + Due date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium">Valor (R$) <span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0,00"
                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[11px] text-gray-600 mt-1">Valor a ser faturado neste marco, em reais.</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium">Data de Vencimento</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[11px] text-gray-600 mt-1">Prazo previsto para faturar. Marcos vencidos são destacados em vermelho.</p>
                </div>
              </div>

              {/* Triggered by */}
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Disparado Por</label>
                <input
                  value={form.triggered_by}
                  onChange={e => setForm(f => ({ ...f, triggered_by: e.target.value }))}
                  placeholder="Ex: Aprovação formal do cliente, Data fixada em contrato"
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-gray-600 mt-1">Condição contratual que autoriza a emissão da nota. Facilita disputas ou auditorias futuras.</p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Status</label>
                <div className="flex gap-2">
                  {(['pending', 'achieved', 'billed'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                        form.status === s ? `${STATUS_CONFIG[s].cls} border-opacity-100` : 'bg-gray-800 border-white/10 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-600 mt-1">Fluxo: Pendente (aguardando entrega) → Atingido (entrega feita, NF pendente) → Faturado (NF emitida).</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Observações</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Detalhes adicionais sobre este marco, escopo entregue, número da NF, etc."
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !form.project_id || !form.name || !form.amount}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-gray-900 font-semibold text-sm rounded-lg transition-colors"
              >
                {saving ? 'Salvando…' : editing ? 'Salvar Alterações' : 'Criar Marco'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
