'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import type { Client, Project } from '@/lib/types/database';

type ProjectWithClient = Project & { client: Pick<Client, 'id' | 'name'> | null };

const emptyForm = {
  name: '', client_id: '', description: '', scope: '',
  started_at: '', estimated_end_at: '',
  contract_value: '', budget_hours: '', budget_cost: '',
  status: 'active',
};

const statusOptions = [
  { value: 'active', label: 'Ativo' },
  { value: 'paused', label: 'Pausado' },
  { value: 'completed', label: 'Concluído' },
  { value: 'cancelled', label: 'Cancelado' },
];

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectWithClient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([fetch('/api/projects'), fetch('/api/clients')]);
    setProjects(await pRes.json());
    setClients(await cRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(p: ProjectWithClient) {
    setEditing(p);
    setForm({
      name: p.name,
      client_id: p.client_id ?? '',
      description: p.description ?? '',
      scope: p.scope ?? '',
      started_at: p.started_at ?? '',
      estimated_end_at: p.estimated_end_at ?? '',
      contract_value: String(p.contract_value),
      budget_hours: String(p.budget_hours),
      budget_cost: String(p.budget_cost),
      status: p.status,
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
    const method = editing ? 'PATCH' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Arquivar este projeto?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    load();
  }

  const f = (k: string) => (v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="p-8">
      <PageHeader
        title="Projetos"
        description="Portfólio de projetos, contratos e orçamentos"
        action={
          <button onClick={openNew} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            + Novo Projeto
          </button>
        }
      />

      {loading ? (
        <div className="text-gray-500 text-sm">Carregando...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-4xl mb-3">📁</p>
          <p className="text-sm">Nenhum projeto cadastrado ainda.</p>
          <button onClick={openNew} className="mt-4 text-blue-400 text-sm hover:underline">Criar primeiro projeto</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-lg font-semibold text-white">{p.name}</h2>
                    <Badge value={p.status} />
                  </div>
                  <p className="text-sm text-gray-400">{p.client?.name ?? 'Sem cliente'}</p>
                  {p.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{p.description}</p>}
                </div>
                <div className="flex gap-2 ml-4">
                  <Link href={`/projects/${p.id}`} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                    Detalhes
                  </Link>
                  <button onClick={() => openEdit(p)} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                    Editar
                  </button>
                  <button onClick={() => remove(p.id)} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-red-900/50 text-gray-500 hover:text-red-400 rounded-lg transition-colors">
                    Arquivar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
                <Metric label="Receita do Contrato" value={fmt(p.contract_value)} color="text-green-400" />
                <Metric label="Budget de Horas" value={`${p.budget_hours}h`} color="text-blue-400" />
                <Metric label="Budget de Custo" value={fmt(p.budget_cost)} color="text-purple-400" />
              </div>

              <div className="flex gap-4 mt-3 text-xs text-gray-600">
                {p.started_at && <span>Início: {new Date(p.started_at).toLocaleDateString('pt-BR')}</span>}
                {p.estimated_end_at && <span>Prazo: {new Date(p.estimated_end_at).toLocaleDateString('pt-BR')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Projeto' : 'Novo Projeto'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome do Projeto *" value={form.name} onChange={f('name')} placeholder="Projeto Manobra" />
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Cliente</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Sem cliente</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <Field label="Descrição" value={form.description} onChange={f('description')} placeholder="Breve descrição do projeto" />
          <Field label="Escopo" value={form.scope} onChange={f('scope')} placeholder="Escopo inicial do contrato" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Data de Início" value={form.started_at} onChange={f('started_at')} type="date" />
            <Field label="Prazo Previsto" value={form.estimated_end_at} onChange={f('estimated_end_at')} type="date" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Receita (R$) *" value={form.contract_value} onChange={f('contract_value')} placeholder="50000" type="number" />
            <Field label="Budget Horas" value={form.budget_hours} onChange={f('budget_hours')} placeholder="200" type="number" />
            <Field label="Budget Custo (R$)" value={form.budget_cost} onChange={f('budget_cost')} placeholder="30000" type="number" />
          </div>

          {editing && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">
              Cancelar
            </button>
            <button onClick={save} disabled={saving || !form.name} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}
