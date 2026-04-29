'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';

interface Client { id: string; name: string; }
interface PipelineProject {
  id: string;
  name: string;
  client: { id: string; name: string } | null;
  probability_pct: number;
  estimated_value: number;
  estimated_hours: number;
  expected_start: string | null;
  expected_duration_months: number | null;
  required_roles: string | null;
  status: string;
  notes: string | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  prospect:    { label: 'Prospecção',   color: 'text-gray-400',   bg: 'bg-gray-500/15 border-gray-500/30' },
  proposal:    { label: 'Proposta',     color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30' },
  negotiation: { label: 'Negociação',   color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' },
  won:         { label: 'Ganho ✓',      color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/30' },
  lost:        { label: 'Perdido',      color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30' },
};

const statusOrder = ['prospect', 'proposal', 'negotiation', 'won', 'lost'];

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0);
}

function fmtK(v: number) {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
  return fmt(v);
}

const emptyForm = {
  name: '', client_id: '', probability_pct: '50',
  estimated_value: '', estimated_hours: '',
  expected_start: '', expected_duration_months: '',
  required_roles: '', status: 'prospect', notes: '',
};

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<PipelineProject[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PipelineProject | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'kanban' | 'table'>('kanban');

  async function load() {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([fetch('/api/pipeline'), fetch('/api/clients')]);
    setPipeline(await pRes.json());
    setClients(await cRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true); }

  function openEdit(p: PipelineProject) {
    setEditing(p);
    setForm({
      name: p.name,
      client_id: p.client?.id ?? '',
      probability_pct: String(p.probability_pct),
      estimated_value: String(p.estimated_value ?? ''),
      estimated_hours: String(p.estimated_hours ?? ''),
      expected_start: p.expected_start ?? '',
      expected_duration_months: String(p.expected_duration_months ?? ''),
      required_roles: p.required_roles ?? '',
      status: p.status,
      notes: p.notes ?? '',
    });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = {
      ...form,
      client_id: form.client_id || null,
      probability_pct: Number(form.probability_pct),
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      expected_start: form.expected_start || null,
      expected_duration_months: form.expected_duration_months ? Number(form.expected_duration_months) : null,
      required_roles: form.required_roles || null,
      notes: form.notes || null,
    };
    const url = editing ? `/api/pipeline/${editing.id}` : '/api/pipeline';
    await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false); setModalOpen(false); load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/pipeline/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Remover este item do pipeline?')) return;
    await fetch(`/api/pipeline/${id}`, { method: 'DELETE' });
    load();
  }

  // KPIs
  const active = pipeline.filter(p => !['won', 'lost'].includes(p.status));
  const totalPipelineValue = active.reduce((s, p) => s + (p.estimated_value ?? 0), 0);
  const weightedValue = active.reduce((s, p) => s + ((p.estimated_value ?? 0) * p.probability_pct / 100), 0);
  const wonThisCycle = pipeline.filter(p => p.status === 'won').reduce((s, p) => s + (p.estimated_value ?? 0), 0);

  return (
    <div className="p-8">
      <PageHeader
        title="Pipeline de Vendas"
        description="Funil de oportunidades e previsão de receita futura"
        action={
          <div className="flex gap-2">
            <div className="flex bg-gray-900/70 border border-white/5 rounded-xl p-1">
              <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${view === 'kanban' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-white'}`}>Kanban</button>
              <button onClick={() => setView('table')} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${view === 'table' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-white'}`}>Tabela</button>
            </div>
            <button onClick={openNew} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity">
              + Nova Oportunidade
            </button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900/70 border border-white/5 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Pipeline Ativo</p>
          <p className="text-2xl font-bold text-white">{fmtK(totalPipelineValue)}</p>
          <p className="text-xs text-gray-600 mt-1">{active.length} oportunidades</p>
        </div>
        <div className="bg-gray-900/70 border border-white/5 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Receita Ponderada</p>
          <p className="text-2xl font-bold text-cyan-400">{fmtK(weightedValue)}</p>
          <p className="text-xs text-gray-600 mt-1">ajustada pela probabilidade</p>
        </div>
        <div className="bg-gray-900/70 border border-white/5 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Contratos Ganhos</p>
          <p className="text-2xl font-bold text-green-400">{fmtK(wonThisCycle)}</p>
          <p className="text-xs text-gray-600 mt-1">{pipeline.filter(p => p.status === 'won').length} projetos convertidos</p>
        </div>
      </div>

      {loading ? <p className="text-gray-500 text-sm">Carregando...</p> : pipeline.length === 0 ? (
        <div className="text-center py-24 text-gray-600">
          <p className="text-5xl mb-4">📈</p>
          <p className="text-sm mb-1">Nenhuma oportunidade no pipeline.</p>
          <button onClick={openNew} className="mt-3 text-cyan-400 text-sm hover:underline">Adicionar primeira oportunidade</button>
        </div>
      ) : view === 'kanban' ? (
        /* Kanban */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statusOrder.map((status) => {
            const items = pipeline.filter(p => p.status === status);
            const cfg = statusConfig[status];
            return (
              <div key={status} className="flex-shrink-0 w-64">
                <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-xl border ${cfg.bg}`}>
                  <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((p) => (
                    <div key={p.id} className="bg-gray-900/70 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors cursor-pointer group"
                      onClick={() => openEdit(p)}>
                      <p className="font-semibold text-white text-sm leading-tight mb-1">{p.name}</p>
                      <p className="text-xs text-gray-500 mb-3">{p.client?.name ?? 'Sem cliente'}</p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-cyan-400">{fmtK(p.estimated_value ?? 0)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.probability_pct >= 70 ? 'bg-green-500/20 text-green-400' :
                          p.probability_pct >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>{p.probability_pct}%</span>
                      </div>
                      {/* Barra de probabilidade */}
                      <div className="w-full bg-gray-800 rounded-full h-1 mb-3">
                        <div className={`h-1 rounded-full transition-all ${
                          p.probability_pct >= 70 ? 'bg-green-500' : p.probability_pct >= 40 ? 'bg-yellow-500' : 'bg-gray-600'
                        }`} style={{ width: `${p.probability_pct}%` }} />
                      </div>
                      {p.estimated_hours && <p className="text-xs text-gray-600">{p.estimated_hours}h estimadas</p>}
                      {/* Avançar status */}
                      {status !== 'won' && status !== 'lost' && (
                        <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          {statusOrder.filter(s => s !== status && s !== 'lost').slice(statusOrder.indexOf(status) + 1).slice(0, 2).map(nextStatus => (
                            <button key={nextStatus} onClick={() => updateStatus(p.id, nextStatus)}
                              className={`flex-1 text-[10px] py-1 rounded-lg border transition-colors ${statusConfig[nextStatus].bg} ${statusConfig[nextStatus].color}`}>
                              → {statusConfig[nextStatus].label}
                            </button>
                          ))}
                          <button onClick={() => remove(p.id)} className="px-2 py-1 text-[10px] rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Tabela */
        <div className="bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-600 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Oportunidade</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Valor Est.</th>
                <th className="text-right px-4 py-3">Probabilidade</th>
                <th className="text-right px-4 py-3">Val. Ponderado</th>
                <th className="text-left px-4 py-3">Início Previsto</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pipeline.map((p) => {
                const cfg = statusConfig[p.status];
                return (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.client?.name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-4 text-right text-white font-semibold tabular-nums">{fmtK(p.estimated_value ?? 0)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-800 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${p.probability_pct >= 70 ? 'bg-green-500' : p.probability_pct >= 40 ? 'bg-yellow-500' : 'bg-gray-600'}`}
                            style={{ width: `${p.probability_pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums w-8">{p.probability_pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-cyan-400 font-semibold tabular-nums">
                      {fmtK((p.estimated_value ?? 0) * p.probability_pct / 100)}
                    </td>
                    <td className="px-4 py-4 text-gray-400 text-xs">
                      {p.expected_start ? new Date(p.expected_start).toLocaleDateString('pt-BR') : '—'}
                      {p.expected_duration_months && <span className="text-gray-600 ml-1">({p.expected_duration_months}m)</span>}
                    </td>
                    <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(p)} className="text-xs text-gray-500 hover:text-cyan-400 mr-3">Editar</button>
                      <button onClick={() => remove(p.id)} className="text-xs text-gray-500 hover:text-red-400">Remover</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Oportunidade' : 'Nova Oportunidade'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome da Oportunidade *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Projeto XYZ" />
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Cliente</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="">Sem cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                {statusOrder.map(s => <option key={s} value={s}>{statusConfig[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Probabilidade: {form.probability_pct}%</label>
              <input type="range" min="0" max="100" step="5" value={form.probability_pct}
                onChange={(e) => setForm({ ...form, probability_pct: e.target.value })}
                className="w-full accent-cyan-500 mt-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor Estimado (R$) *" value={form.estimated_value} onChange={(v) => setForm({ ...form, estimated_value: v })} placeholder="50000" type="number" />
            <Field label="Horas Estimadas" value={form.estimated_hours} onChange={(v) => setForm({ ...form, estimated_hours: v })} placeholder="200" type="number" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Início Previsto" value={form.expected_start} onChange={(v) => setForm({ ...form, expected_start: v })} type="date" />
            <Field label="Duração (meses)" value={form.expected_duration_months} onChange={(v) => setForm({ ...form, expected_duration_months: v })} placeholder="3" type="number" />
          </div>
          <Field label="Perfis Necessários" value={form.required_roles} onChange={(v) => setForm({ ...form, required_roles: v })} placeholder="2x Dev Senior, 1x PM" />
          <Field label="Observações" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Contexto da oportunidade..." />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium transition-opacity">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors" />
    </div>
  );
}
