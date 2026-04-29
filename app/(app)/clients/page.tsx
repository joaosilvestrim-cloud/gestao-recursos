'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import FieldHelp from '@/components/ui/FieldHelp';
import InfoBox from '@/components/ui/InfoBox';
import type { Client } from '@/lib/types/database';

interface Group { id: string; name: string; }

const empty = { name: '', email: '', phone: '', document: '', group_id: '' };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [cRes, gRes] = await Promise.all([fetch('/api/clients'), fetch('/api/groups')]);
    setClients(await cRes.json());
    setGroups(await gRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(empty); setModalOpen(true); }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      document: c.document ?? '',
      group_id: (c as Client & { group_id?: string }).group_id ?? '',
    });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = { ...form, group_id: form.group_id || null };
    const url = editing ? `/api/clients/${editing.id}` : '/api/clients';
    const method = editing ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); alert(err.error); }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Desativar este cliente? Os projetos vinculados serão mantidos.')) return;
    await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Clientes"
        description="Empresas contratantes dos projetos — segundo nível da hierarquia financeira"
        action={
          <button onClick={openNew} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity">
            + Novo Cliente
          </button>
        }
      />

      <InfoBox icon="🏢" title="Para que serve este menu?">
        <p>
          Clientes são as <strong className="text-white">empresas que contratam seus projetos</strong>. A hierarquia é:
          <strong className="text-white"> Grupo → Cliente → Projeto</strong>.
        </p>
        <p className="mt-1">
          Vincular o cliente a um grupo permite que o sistema consolide o P&amp;L de todos os projetos daquele cliente
          dentro do relatório do grupo. Ex: <em>Tambasa Logística</em> é cliente dentro do <em>Tambasa Group</em>.
        </p>
        <p className="mt-1 text-gray-500">
          Dica: cadastre os <strong className="text-gray-400">Grupos</strong> antes de cadastrar os clientes para poder fazer a vinculação.
        </p>
      </InfoBox>

      {loading ? (
        <p className="text-gray-500 text-sm mt-6">Carregando...</p>
      ) : clients.length === 0 ? (
        <div className="text-center py-20 text-gray-600 mt-6">
          <p className="text-4xl mb-3">🏢</p>
          <p className="text-sm">Nenhum cliente cadastrado ainda.</p>
          <button onClick={openNew} className="mt-4 text-cyan-400 text-sm hover:underline">Cadastrar primeiro cliente</button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Nome</th>
                <th className="text-left px-6 py-3">Grupo</th>
                <th className="text-left px-6 py-3">E-mail</th>
                <th className="text-left px-6 py-3">CNPJ/CPF</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors group">
                  <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {groups.find(g => g.id === (c as Client & { group_id?: string }).group_id)?.name ?? <span className="text-gray-700 italic">Sem grupo</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-400">{c.email ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-400">{c.document ?? '—'}</td>
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(c)} className="text-gray-500 hover:text-cyan-400 mr-3 text-xs">Editar</button>
                    <button onClick={() => remove(c.id)} className="text-gray-500 hover:text-red-400 text-xs">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Cliente' : 'Novo Cliente'}>
        <div className="space-y-5">
          <InfoBox icon="💡" title="Como preencher" variant="tip">
            <p>O nome do cliente aparece em todos os relatórios de P&amp;L. Use a razão social ou nome fantasia que o identifica internamente na empresa.</p>
          </InfoBox>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nome *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Tambasa Distribuidora S.A."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
            />
            <FieldHelp text="Razão social ou nome fantasia. Este nome aparece em todos os relatórios de P&L e na Visão Executiva. Use o nome que a equipe reconhece internamente." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Grupo / Holding</label>
            <select
              value={form.group_id}
              onChange={(e) => setForm({ ...form, group_id: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Sem grupo (cliente independente)</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <FieldHelp text="Vincula este cliente a uma holding ou unidade de negócio. Clientes no mesmo grupo têm seu P&L consolidado no relatório do grupo. Se o cliente não pertence a nenhum grupo cadastrado, deixe em branco." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contato@empresa.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
              />
              <FieldHelp text="E-mail do ponto de contato principal. Usado para referência interna, não é enviado automaticamente." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Telefone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
              />
              <FieldHelp text="Telefone comercial para contato. Campo informativo para a equipe." />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">CNPJ / CPF</label>
            <input
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
              placeholder="00.000.000/0001-00"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
            />
            <FieldHelp text="Documento fiscal do cliente. Essencial para controle de faturamento e emissão de notas fiscais. Preencha sempre que possível para manter a rastreabilidade financeira." />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium transition-opacity">
              {saving ? 'Salvando...' : 'Salvar Cliente'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
