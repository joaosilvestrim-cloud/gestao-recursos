'use client';

import { useEffect, useState, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import type { Collaborator } from '@/lib/types/database';

type CollaboratorWithCost = Collaborator & {
  current_cost: { hourly_cost: number; valid_until: string | null }[];
};

const seniorityOptions = [
  { value: 'junior', label: 'Júnior' },
  { value: 'pleno', label: 'Pleno' },
  { value: 'senior', label: 'Sênior' },
  { value: 'especialista', label: 'Especialista' },
  { value: 'lider', label: 'Líder' },
];

const emptyForm = {
  name: '', email: '', role: '', department: '',
  seniority: 'pleno', weekly_capacity_hours: '40', hourly_cost: '',
};

function currentHourlyCost(c: CollaboratorWithCost): number | null {
  return c.current_cost?.find(h => !h.valid_until)?.hourly_cost ?? null;
}

function monthlyFromHourly(hourly: number | null, weeklyH: number): number | null {
  if (hourly === null) return null;
  return hourly * weeklyH * 4.33;
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

export default function CollaboratorsPage() {
  const [collaborators, setCollaborators] = useState<CollaboratorWithCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CollaboratorWithCost | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/collaborators');
    setCollaborators(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    collaborators.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.role.toLowerCase().includes(search.toLowerCase()) ||
      (c.department ?? '').toLowerCase().includes(search.toLowerCase())
    ), [collaborators, search]);

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true); }

  function openEdit(c: CollaboratorWithCost) {
    setEditing(c);
    const hh = currentHourlyCost(c);
    setForm({
      name: c.name, email: c.email, role: c.role,
      department: c.department ?? '', seniority: c.seniority ?? 'pleno',
      weekly_capacity_hours: String(c.weekly_capacity_hours),
      hourly_cost: hh !== null ? String(hh) : '',
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
    await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false); setModalOpen(false); load();
  }

  async function remove(id: string) {
    if (!confirm('Desativar este colaborador?')) return;
    await fetch(`/api/collaborators/${id}`, { method: 'DELETE' });
    load();
  }

  const totalMonthly = collaborators.reduce((s, c) => {
    const hh = currentHourlyCost(c);
    const monthly = monthlyFromHourly(hh, c.weekly_capacity_hours);
    return s + (monthly ?? 0);
  }, 0);

  return (
    <div className="p-8">
      <PageHeader
        title="Colaboradores"
        description="Base de custo H/H — fundação do motor financeiro"
        action={
          <button onClick={openNew} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity">
            + Novo Colaborador
          </button>
        }
      />

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900/70 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Colaboradores Ativos</p>
          <p className="text-2xl font-bold text-white">{collaborators.length}</p>
        </div>
        <div className="bg-gray-900/70 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Custo Mensal Total da Equipe</p>
          <p className="text-2xl font-bold text-red-400">{fmt(totalMonthly)}</p>
        </div>
        <div className="bg-gray-900/70 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Capacidade Total (h/sem)</p>
          <p className="text-2xl font-bold text-cyan-400">
            {collaborators.reduce((s, c) => s + c.weekly_capacity_hours, 0)}h
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, cargo ou departamento..."
          className="w-full bg-gray-900/70 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">✕</button>
        )}
      </div>

      {loading ? <p className="text-gray-500 text-sm">Carregando...</p> : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-sm">{search ? 'Nenhum resultado para a busca.' : 'Nenhum colaborador cadastrado.'}</p>
          {!search && <button onClick={openNew} className="mt-3 text-cyan-400 text-sm hover:underline">Cadastrar primeiro colaborador</button>}
        </div>
      ) : (
        <div className="bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-600 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Nome / Cargo</th>
                <th className="text-left px-4 py-3">Seniority</th>
                <th className="text-left px-4 py-3">Depto</th>
                <th className="text-right px-4 py-3">Capacidade</th>
                <th className="text-right px-4 py-3 text-cyan-500">⚡ Custo H/H</th>
                <th className="text-right px-4 py-3">Custo Mensal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const hh = currentHourlyCost(c);
                const monthly = monthlyFromHourly(hh, c.weekly_capacity_hours);
                return (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{c.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.email}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{c.role}</p>
                    </td>
                    <td className="px-4 py-4">{c.seniority ? <Badge value={c.seniority} /> : '—'}</td>
                    <td className="px-4 py-4 text-gray-400 text-xs">{c.department ?? '—'}</td>
                    <td className="px-4 py-4 text-right text-gray-400 text-xs tabular-nums">{c.weekly_capacity_hours}h/sem</td>
                    <td className="px-4 py-4 text-right">
                      {hh !== null ? (
                        <span className="font-mono font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2 py-1 rounded-lg text-xs">
                          {fmt(hh)}/h
                        </span>
                      ) : (
                        <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">Não definido</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-300 text-sm tabular-nums font-semibold">
                      {monthly !== null ? fmt(monthly) : '—'}
                    </td>
                    <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(c)} className="text-xs text-gray-500 hover:text-cyan-400 mr-3">Editar</button>
                      <button onClick={() => remove(c.id)} className="text-xs text-gray-500 hover:text-red-400">Remover</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Colaborador' : 'Novo Colaborador'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Engel Trindade" />
            <Field label="E-mail *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="engel@drivedata.com" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cargo / Skill Principal *" value={form.role} onChange={(v) => setForm({ ...form, role: v })} placeholder="Especialista em Integrações" />
            <Field label="Departamento" value={form.department} onChange={(v) => setForm({ ...form, department: v })} placeholder="Tecnologia" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Seniority</label>
              <select value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                {seniorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Field label="Capacidade (h/sem)" value={form.weekly_capacity_hours} onChange={(v) => setForm({ ...form, weekly_capacity_hours: v })} placeholder="40" type="number" />
          </div>

          {/* Campo crítico destacado */}
          <div className="bg-cyan-500/5 border border-cyan-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-cyan-400 text-sm">⚡</span>
              <label className="text-xs font-bold text-cyan-400 uppercase tracking-wide">Custo Hora/Homem — Métrica Crítica</label>
            </div>
            <p className="text-xs text-gray-500 mb-3">Este valor é a base do cálculo de rentabilidade de todos os projetos. Alterações criam um novo período no histórico.</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R$</span>
              <input
                type="number"
                value={form.hourly_cost}
                onChange={(e) => setForm({ ...form, hourly_cost: e.target.value })}
                placeholder="0,00 por hora"
                className="w-full bg-gray-800 border border-cyan-500/50 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 font-semibold"
              />
            </div>
            {form.hourly_cost && form.weekly_capacity_hours && (
              <p className="text-xs text-cyan-400/70 mt-2">
                ≈ {fmt(Number(form.hourly_cost) * Number(form.weekly_capacity_hours) * 4.33)}/mês estimado
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name || !form.email || !form.role}
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
