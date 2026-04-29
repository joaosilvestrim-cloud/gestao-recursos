'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import type { Client } from '@/lib/types/database';

const empty = { name: '', email: '', phone: '', document: '' };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/clients');
    setClients(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', document: c.document ?? '' });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    const url = editing ? `/api/clients/${editing.id}` : '/api/clients';
    const method = editing ? 'PATCH' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Desativar este cliente?')) return;
    await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Clientes"
        description="Empresas e contratantes dos projetos"
        action={
          <button onClick={openNew} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            + Novo Cliente
          </button>
        }
      />

      {loading ? (
        <div className="text-gray-500 text-sm">Carregando...</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-4xl mb-3">🏢</p>
          <p className="text-sm">Nenhum cliente cadastrado ainda.</p>
          <button onClick={openNew} className="mt-4 text-blue-400 text-sm hover:underline">Cadastrar primeiro cliente</button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Nome</th>
                <th className="text-left px-6 py-3">E-mail</th>
                <th className="text-left px-6 py-3">Telefone</th>
                <th className="text-left px-6 py-3">CNPJ/CPF</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                  <td className="px-6 py-4 text-gray-400">{c.email ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-400">{c.phone ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-400">{c.document ?? '—'}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Cliente' : 'Novo Cliente'}>
        <div className="space-y-4">
          <Field label="Nome *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Eagles Group" />
          <Field label="E-mail" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="contato@empresa.com" type="email" />
          <Field label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(11) 99999-9999" />
          <Field label="CNPJ / CPF" value={form.document} onChange={(v) => setForm({ ...form, document: v })} placeholder="00.000.000/0001-00" />
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
