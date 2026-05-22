'use client';

import { useEffect, useState } from 'react';
import { ROLE_LABELS, ROLE_COLORS, type Role } from '@/lib/auth/roles';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
}

const ROLES: Role[] = ['director', 'finance', 'manager', 'collaborator'];

const ROLE_ACCESS: Record<Role, string[]> = {
  director: ['Tudo — acesso completo ao sistema'],
  finance: ['Visão Executiva', 'P&L', 'Faturamento', 'KPIs', 'Custos Indiretos', 'Despesas', 'Wiki'],
  manager: ['Projetos', 'Pipeline', 'Lançar horas', 'Despesas', 'Capacity', 'Wiki'],
  collaborator: ['Somente Wiki / Intranet'],
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'manager' as Role, password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserProfile | null>(null);

  async function load() {
    const data = await fetch('/api/admin/users').then(r => r.json());
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditUser(null);
    setForm({ email: '', name: '', role: 'manager', password: '' });
    setError('');
    setShowModal(true);
  }

  function openEdit(u: UserProfile) {
    setEditUser(u);
    setForm({ email: u.email, name: u.name ?? '', role: u.role, password: '' });
    setError('');
    setShowModal(true);
  }

  async function save() {
    if (!editUser && (!form.email || !form.password)) {
      setError('E-mail e senha são obrigatórios para novo usuário.');
      return;
    }
    setSaving(true);
    setError('');

    if (editUser) {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, role: form.role }),
      });
      if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    } else {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    }

    setSaving(false);
    setShowModal(false);
    load();
  }

  async function deactivate(u: UserProfile) {
    await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    setConfirmDeactivate(null);
    load();
  }

  const filtered = users.filter(u =>
    !search ||
    (u.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const byRole = ROLES.map(r => ({ role: r, count: users.filter(u => u.role === r && u.active).length }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🔐 Usuários & Acessos</h1>
          <p className="text-sm text-gray-400 mt-1">
            Gerencie quem tem acesso ao sistema e qual o nível de permissão de cada pessoa.
          </p>
        </div>
        <button onClick={openNew}
          className="shrink-0 bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          + Adicionar Usuário
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
        <p className="font-semibold text-blue-200 mb-1">📖 Como funciona o controle de acesso</p>
        <ul className="text-[13px] space-y-1 text-blue-300/80 list-disc list-inside">
          <li>Cada usuário recebe um <strong>perfil de acesso</strong> que define quais menus ele vê</li>
          <li>A <strong>senha</strong> é definida aqui e entregue ao colaborador. Ele pode alterar depois</li>
          <li>Usuários <strong>desativados</strong> perdem acesso imediatamente mas o histórico é mantido</li>
          <li>Somente a <strong>Diretoria</strong> pode criar, editar e desativar usuários</li>
        </ul>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {byRole.map(({ role, count }) => (
          <div key={role} className="bg-gray-900 border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${ROLE_COLORS[role]}`}>
                {ROLE_LABELS[role]}
              </span>
              <span className="text-2xl font-bold text-white">{count}</span>
            </div>
            <ul className="space-y-0.5">
              {ROLE_ACCESS[role].map((a, i) => (
                <li key={i} className="text-[10px] text-gray-600">· {a}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="w-full bg-gray-900 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Users table */}
      <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] text-gray-500 font-medium">Usuário</th>
              <th className="px-4 py-3 text-left text-[11px] text-gray-500 font-medium">Perfil</th>
              <th className="px-4 py-3 text-left text-[11px] text-gray-500 font-medium">Acessos</th>
              <th className="px-4 py-3 text-center text-[11px] text-gray-500 font-medium">Status</th>
              <th className="px-4 py-3 text-center text-[11px] text-gray-500 font-medium">Desde</th>
              <th className="px-4 py-3 text-right text-[11px] text-gray-500 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-600">Nenhum usuário encontrado.</td></tr>
            )}
            {filtered.map(u => (
              <tr key={u.id} className={`border-b border-white/5 hover:bg-white/2 transition-colors ${!u.active ? 'opacity-50' : ''}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-xs font-bold text-cyan-300">
                      {(u.name ?? u.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-gray-200 font-medium">{u.name ?? '—'}</p>
                      <p className="text-[11px] text-gray-600">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ul className="space-y-0.5">
                    {ROLE_ACCESS[u.role].slice(0, 3).map((a, i) => (
                      <li key={i} className="text-[11px] text-gray-600">· {a}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${u.active ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    {u.active ? '● Ativo' : '● Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-[11px] text-gray-600">{fmtDate(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(u)}
                      className="px-2.5 py-1.5 text-[11px] bg-white/5 hover:bg-white/10 text-gray-400 rounded transition-colors">
                      Editar
                    </button>
                    {u.active && (
                      <button onClick={() => setConfirmDeactivate(u)}
                        className="px-2.5 py-1.5 text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors">
                        Desativar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editUser ? 'Editar Usuário' : 'Adicionar Usuário'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {!editUser && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-300">
                  💡 O usuário recebe a senha agora e pode alterá-la após o primeiro login. O e-mail precisa ser válido.
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Nome</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nome completo"
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
                <p className="text-[11px] text-gray-600 mt-1">Aparece no menu lateral e no histórico de edições da wiki.</p>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">E-mail {!editUser && <span className="text-red-400">*</span>}</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="colaborador@empresa.com" disabled={!!editUser}
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 disabled:opacity-50" />
              </div>

              {!editUser && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium">Senha inicial <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">
                      {showPass ? '🙈' : '👁'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">Anote e compartilhe com o colaborador de forma segura.</p>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium">Perfil de Acesso <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r => (
                    <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={`p-3 rounded-xl border text-left transition-all ${form.role === r ? `${ROLE_COLORS[r]} border-opacity-100` : 'bg-gray-800 border-white/10 hover:border-white/20'}`}>
                      <p className="text-xs font-semibold">{ROLE_LABELS[r]}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{ROLE_ACCESS[r][0]}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-2 bg-gray-800/50 rounded-lg p-3">
                  <p className="text-[11px] text-gray-500 font-medium mb-1">Acessos do perfil selecionado:</p>
                  <ul className="space-y-0.5">
                    {ROLE_ACCESS[form.role].map((a, i) => (
                      <li key={i} className="text-[11px] text-gray-400">✓ {a}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">{error}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={save} disabled={saving}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-gray-900 font-semibold text-sm rounded-lg transition-colors">
                {saving ? 'Salvando…' : editUser ? 'Salvar' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Desativar usuário?</h2>
            <p className="text-sm text-gray-400">
              <strong className="text-white">{confirmDeactivate.name ?? confirmDeactivate.email}</strong> perderá acesso imediatamente.
              O histórico de atividades é mantido. Você pode reativar a qualquer momento.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setConfirmDeactivate(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={() => deactivate(confirmDeactivate)}
                className="px-5 py-2 bg-red-500 hover:bg-red-400 text-white font-semibold text-sm rounded-lg transition-colors">
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
