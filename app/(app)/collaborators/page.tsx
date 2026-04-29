'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import type { Collaborator } from '@/lib/types/database';

type CollaboratorWithCost = Collaborator & {
  current_cost: { hourly_cost: number; valid_from: string; valid_until: string | null }[];
};

const emptyForm = {
  name: '', email: '', role: '', department: '',
  seniority: 'pleno', weekly_capacity_hours: '40', hourly_cost: '',
};

const seniorityOptions = [
  { value: 'junior', label: 'Júnior' },
  { value: 'pleno', label: 'Pleno' },
  { value: 'senior', label: 'Sênior' },
  { value: 'especialista', label: 'Especialista' },
  { value: 'lider', label: 'Líder' },
];

export default function CollaboratorsPage() {
  const [collaborators, setCollaborators] = useState<CollaboratorWithCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CollaboratorWithCost | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/collaborators');
    setCollaborators(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function currentCost(c: CollaboratorWithCost) {
    return c.current_cost?.find((h) => !h.valid_until)?.hourly_cost ?? null;
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: CollaboratorWithCost) {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email,
      role: c.role,
      department: c.department ?? '',
      seniority: c.seniority ?? 'pleno',
      weekly_capacity_hours: String(c.weekly_capacity_hours),
      hourly_cost: String(currentCost(c) ?? ''),
    });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = {
      ...form,
      weekly_capacity_hours: Number(form.weekly_capacity_hours),
      hourly_cost: form.hourly_cost ? Number(form.hourly_cost) : undefined,
    };
    const url = editing ? `/api/collaborators/${editing.id}` : '/api/collaborators';
    const method = editing ? 'PATCH' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Desativar este colaborador?')) return;
    await fetch(`/api/collaborators/${id}`, { method: 'DELETE' });
    load();
  }

  const f = (v: string) => (s: string) => setForm((prev) => ({ ...prev, [v]: s }));

  return (
    <div className="p-8">
      <PageHeader
        title="Colaboradores"
        description="Equipe, cargos, seniority e custo H/H"
        action={
          <button onClick={openNew} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            + Novo Colaborador
          </button>
        }
      />

      {loading ? (
        <div className="text-gray-500 text-sm">Carregando...</div>
      ) : collaborators.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-sm">Nenhum colaborador cadastrado ainda.</p>
          <button onClick={openNew} className="mt-4 text-blue-400 text-sm hover:underline">Cadastrar primeiro colaborador</button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Nome</th>
                <th className="text-left px-6 py-3">Cargo</th>
                <th className="text-left px-6 py-3">Depto</th>
                <th className="text-left px-6 py-3">Seniority</th>
                <th className="text-left px-6 py-3">Capacidade</th>
                <th className="text-left px-6 py-3">Custo H/H</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {collaborators.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.email}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{c.role}</td>
                  <td className="px-6 py-4 text-gray-400">{c.department ?? '—'}</td>
                  <td className="px-6 py-4">{c.seniority ? <Badge value={c.seniority} /> : '—'}</td>
                  <td className="px-6 py-4 text-gray-400">{c.weekly_capacity_hours}h/sem</td>
                  <td className="px-6 py-4">
                    {currentCost(c) != null
                      ? <span className="text-green-400 font-mono text-xs">R$ {Number(currentCost(c)).toFixed(2)}/h</span>
                      : <span className="text-gray-600 text-xs">Não definido</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEdit(c)} className="text-gray-500 hover:text-blue-400 mr-3 text-xs">Editar</button>
                    <button onClick={() => remove(c.id)} className="text-gray-500 hover:text-red-400 text-xs">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Colaborador' : 'Novo Colaborador'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome *" value={form.name} onChange={f('name')} placeholder="Engel Trindade" />
            <Field label="E-mail *" value={form.email} onChange={f('email')} placeholder="engel@empresa.com" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cargo *" value={form.role} onChange={f('role')} placeholder="Consultor de TI" />
            <Field label="Departamento" value={form.department} onChange={f('department')} placeholder="Tecnologia" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Seniority</label>
              <select
                value={form.seniority}
                onChange={(e) => setForm({ ...form, seniority: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {seniorityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Field label="Capacidade (h/sem)" value={form.weekly_capacity_hours} onChange={f('weekly_capacity_hours')} placeholder="40" type="number" />
            <Field label="Custo H/H (R$)" value={form.hourly_cost} onChange={f('hourly_cost')} placeholder="150.00" type="number" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">
              Cancelar
            </button>
            <button onClick={save} disabled={saving || !form.name || !form.email || !form.role} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
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
