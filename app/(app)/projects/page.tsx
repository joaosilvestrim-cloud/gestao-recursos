'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import type { Client, Project } from '@/lib/types/database';

type ProjectWithClient = Project & { client: Pick<Client, 'id' | 'name'> | null };

const emptyForm = {
  name: '', client_id: '', description: '', scope: '',
  started_at: '', estimated_end_at: '',
  contract_value: '', budget_hours: '', budget_cost: '',
  status: 'active',
};

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0);
}

type HealthStatus = 'on_track' | 'attention' | 'critical';

function getHealth(p: ProjectWithClient): HealthStatus {
  if (!p.estimated_end_at) return 'on_track';
  const daysLeft = Math.ceil((new Date(p.estimated_end_at).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return 'critical';
  if (daysLeft < 14) return 'attention';
  return 'on_track';
}

function StatusBadge({ status, health }: { status: string; health: HealthStatus }) {
  if (status === 'completed') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">✓ Concluído</span>;
  if (status === 'paused')    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">⏸ Pausado</span>;
  if (status === 'cancelled') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">✕ Cancelado</span>;
  const map: Record<HealthStatus, { label: string; cls: string }> = {
    on_track:  { label: '● No Prazo',  cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
    attention: { label: '● Atenção',   cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    critical:  { label: '● Atrasado',  cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  };
  const { label, cls } = map[health];
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>{label}</span>;
}

function BudgetBar({ value, label }: { value: number; label: string }) {
  const capped = Math.min(value ?? 0, 100);
  const color = capped >= 90 ? 'bg-red-500' : capped >= 70 ? 'bg-yellow-500' : 'bg-gradient-to-r from-cyan-500 to-green-500';
  return (
    <div className="min-w-[100px]">
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>{label}</span><span className="tabular-nums">{capped.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${capped}%` }} />
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectWithClient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  async function load() {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([fetch('/api/projects'), fetch('/api/clients')]);
    setProjects(await pRes.json());
    setClients(await cRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true); }

  function openEdit(p: ProjectWithClient) {
    setEditing(p);
    setForm({
      name: p.name, client_id: p.client_id ?? '', description: p.description ?? '',
      scope: p.scope ?? '', started_at: p.started_at ?? '', estimated_end_at: p.estimated_end_at ?? '',
      contract_value: String(p.contract_value), budget_hours: String(p.budget_hours),
      budget_cost: String(p.budget_cost), status: p.status,
    });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = {
      ...form,
      contract_value: Number(form.contract_value) || 0,
      budget_hours: Number(form.budget_hours) || 0,
      budget_cost: Number(form.budget_cost) || 0,
      client_id: form.client_id || null,
      started_at: form.started_at || null,
      estimated_end_at: form.estimated_end_at || null,
    };
    const url = editing ? `/api/projects/${editing.id}` : '/api/projects';
    await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false); setModalOpen(false); load();
  }

  const filtered = projects.filter(p => filterStatus === 'all' || p.status === filterStatus);

  return (
    <div className="p-8">
      <PageHeader
        title="Projetos"
        description="Portfólio de contratos, orçamentos e status de saúde"
        action={
          <button onClick={openNew} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity">
            + Novo Projeto
          </button>
        }
      />

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
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Contrato</th>
                <th className="text-right px-4 py-3">Prazo</th>
                <th className="px-4 py-3 w-40">Budget Consumido</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const health = getHealth(p);
                const daysLeft = p.estimated_end_at
                  ? Math.ceil((new Date(p.estimated_end_at).getTime() - Date.now()) / 86400000)
                  : null;
                return (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.client?.name ?? <span className="italic">Sem cliente</span>}</p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={p.status} health={health} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-white font-semibold tabular-nums text-sm">{fmt(p.contract_value)}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{p.budget_hours}h estimadas</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {p.estimated_end_at ? (
                        <>
                          <p className="text-gray-300 text-xs tabular-nums">{new Date(p.estimated_end_at).toLocaleDateString('pt-BR')}</p>
                          <p className={`text-xs mt-0.5 ${daysLeft !== null && daysLeft < 0 ? 'text-red-400' : daysLeft !== null && daysLeft < 14 ? 'text-yellow-400' : 'text-gray-600'}`}>
                            {daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}d atrasado` : `${daysLeft}d restantes`) : ''}
                          </p>
                        </>
                      ) : <span className="text-gray-700 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      <BudgetBar value={0} label="custo" />
                    </td>
                    <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/projects/${p.id}`} className="text-xs text-cyan-400 hover:underline mr-3">Detalhes</Link>
                      <button onClick={() => openEdit(p)} className="text-xs text-gray-500 hover:text-white mr-3">Editar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Projeto' : 'Novo Projeto'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome do Projeto *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Projeto Manobra" />
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Cliente</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="">Sem cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <Field label="Escopo / Descrição" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Objetivo e escopo do projeto" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data de Início" value={form.started_at} onChange={(v) => setForm({ ...form, started_at: v })} type="date" />
            <Field label="Data de Entrega *" value={form.estimated_end_at} onChange={(v) => setForm({ ...form, estimated_end_at: v })} type="date" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Valor do Contrato (R$) *" value={form.contract_value} onChange={(v) => setForm({ ...form, contract_value: v })} placeholder="50000" type="number" />
            <Field label="Horas Estimadas" value={form.budget_hours} onChange={(v) => setForm({ ...form, budget_hours: v })} placeholder="200" type="number" />
            <Field label="Budget de Custo (R$)" value={form.budget_cost} onChange={(v) => setForm({ ...form, budget_cost: v })} placeholder="30000" type="number" />
          </div>
          {editing && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                {['active', 'paused', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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
