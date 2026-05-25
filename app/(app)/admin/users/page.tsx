'use client';

import { useEffect, useState, useMemo } from 'react';
import { ROLE_LABELS, ROLE_COLORS, type Role } from '@/lib/auth/roles';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const ROLES: Role[] = ['director', 'finance', 'manager', 'collaborator'];

const ROLE_ACCESS: Record<Role, string[]> = {
  director: ['Acesso total ao sistema', 'Painel Admin', 'P&L / Faturamento / KPIs', 'Portfólio e Financeiro', 'Wiki'],
  finance: ['Dashboard / P&L / KPIs', 'Custos Indiretos e Despesas', 'Projetos (leitura)', 'Wiki'],
  manager: ['Projetos / Pipeline', 'Lançar horas / Despesas', 'Capacity Forecast', 'Wiki'],
  collaborator: ['Somente Wiki / Intranet'],
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

type ModalMode = 'create' | 'edit' | 'password' | 'confirm_deactivate' | 'confirm_reactivate' | 'reset_link';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: ModalMode; user?: UserProfile } | null>(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'manager' as Role, password: '', change_summary: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [resetLink, setResetLink] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [toast, setToast] = useState('');

  async function load() {
    const data = await fetch('/api/admin/users').then(r => r.json());
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  function openCreate() {
    setForm({ email: '', name: '', role: 'manager', password: '', change_summary: '' });
    setError('');
    setShowPass(false);
    setModal({ mode: 'create' });
  }

  function openEdit(u: UserProfile) {
    setForm({ email: u.email, name: u.name ?? '', role: u.role, password: '', change_summary: '' });
    setError('');
    setModal({ mode: 'edit', user: u });
  }

  function openPassword(u: UserProfile) {
    setForm(f => ({ ...f, password: '' }));
    setError('');
    setShowPass(false);
    setModal({ mode: 'password', user: u });
  }

  async function saveCreate() {
    if (!form.email || !form.password) { setError('E-mail e senha são obrigatórios.'); return; }
    if (form.password.length < 8) { setError('Senha precisa ter ao menos 8 caracteres.'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, name: form.name, role: form.role, password: form.password }),
    });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false); setModal(null); load();
    showToast(`✅ Usuário ${form.name || form.email} criado com sucesso`);
  }

  async function saveEdit() {
    if (!modal?.user) return;
    setSaving(true); setError('');
    const res = await fetch(`/api/admin/users/${modal.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, role: form.role }),
    });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false); setModal(null); load();
    showToast(`✅ Perfil de ${form.name || modal.user.email} atualizado`);
  }

  async function savePassword() {
    if (!modal?.user) return;
    if (!form.password || form.password.length < 8) { setError('Senha precisa ter ao menos 8 caracteres.'); return; }
    setSaving(true); setError('');
    const res = await fetch(`/api/admin/users/${modal.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_password', password: form.password }),
    });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false); setModal(null);
    showToast(`🔑 Senha de ${modal.user.name ?? modal.user.email} redefinida`);
  }

  async function doResetLink(u: UserProfile) {
    setSaving(true);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_password' }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    setResetLink(data.link ?? '');
    setModal({ mode: 'reset_link', user: u });
  }

  async function deactivate(u: UserProfile) {
    setSaving(true);
    await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    setSaving(false); setModal(null); load();
    showToast(`⛔ ${u.name ?? u.email} desativado`);
  }

  async function reactivate(u: UserProfile) {
    setSaving(true);
    await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reactivate' }),
    });
    setSaving(false); setModal(null); load();
    showToast(`✅ ${u.name ?? u.email} reativado`);
  }

  const filtered = useMemo(() => users.filter(u => {
    if (filterStatus === 'active' && !u.active) return false;
    if (filterStatus === 'inactive' && u.active) return false;
    if (filterRole && u.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return (u.name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  }), [users, filterStatus, filterRole, search]);

  const counts = useMemo(() => ({
    all: users.length,
    active: users.filter(u => u.active).length,
    inactive: users.filter(u => !u.active).length,
    byRole: Object.fromEntries(ROLES.map(r => [r, users.filter(u => u.role === r && u.active).length])),
  }), [users]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 border border-white/10 rounded-xl px-5 py-3 text-sm text-white shadow-2xl animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">👥 Usuários & Acessos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Crie usuários, defina perfis, redefina senhas e controle ativações.
          </p>
        </div>
        <button onClick={openCreate}
          className="shrink-0 bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          + Novo Usuário
        </button>
      </div>

      {/* Role pills summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-600">Ativos por perfil:</span>
        {ROLES.map(r => (
          <span key={r} className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${ROLE_COLORS[r]}`}>
            {ROLE_LABELS[r]} · {counts.byRole[r]}
          </span>
        ))}
        <span className="text-xs text-gray-600 ml-2">Total: <strong className="text-white">{counts.active}</strong> ativos, {counts.inactive} inativos</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail…"
            className="w-full bg-gray-900 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
        </div>

        <div className="flex items-center bg-gray-900 border border-white/10 rounded-lg overflow-hidden text-xs">
          {[['', 'Todos'], ['active', 'Ativos'], ['inactive', 'Inativos']].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`px-3 py-2 transition-colors ${filterStatus === val ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>

        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500">
          <option value="">Todos os perfis</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>

        {(search || filterRole || filterStatus !== 'active') && (
          <button onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus('active'); }}
            className="text-xs text-gray-500 hover:text-gray-300 underline">
            limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 bg-gray-950/50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] text-gray-500 font-medium">Usuário</th>
              <th className="px-4 py-3 text-left text-[11px] text-gray-500 font-medium">Perfil de Acesso</th>
              <th className="px-4 py-3 text-left text-[11px] text-gray-500 font-medium">Permissões</th>
              <th className="px-4 py-3 text-center text-[11px] text-gray-500 font-medium">Status</th>
              <th className="px-4 py-3 text-center text-[11px] text-gray-500 font-medium">Criado em</th>
              <th className="px-4 py-3 text-right text-[11px] text-gray-500 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">
                Nenhum usuário encontrado com os filtros aplicados.
              </td></tr>
            )}
            {filtered.map(u => (
              <tr key={u.id} className={`border-b border-white/5 transition-colors hover:bg-white/2 ${!u.active ? 'opacity-60' : ''}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${u.active ? 'bg-gradient-to-br from-cyan-500/30 to-purple-500/30 text-cyan-300' : 'bg-gray-800 text-gray-500'}`}>
                      {(u.name ?? u.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-gray-200 font-medium">{u.name ?? <span className="italic text-gray-600">Sem nome</span>}</p>
                      <p className="text-[11px] text-gray-600">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <div className="flex flex-wrap gap-1">
                    {ROLE_ACCESS[u.role].slice(0, 3).map((a, i) => (
                      <span key={i} className="text-[10px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded">
                        {a}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${u.active ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    {u.active ? '● Ativo' : '● Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-[11px] text-gray-600">{fmtDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    {u.active ? (
                      <>
                        <button onClick={() => openEdit(u)}
                          className="px-2.5 py-1.5 text-[11px] bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors">
                          Editar
                        </button>
                        <button onClick={() => openPassword(u)}
                          className="px-2.5 py-1.5 text-[11px] bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors">
                          🔑 Senha
                        </button>
                        <button onClick={() => doResetLink(u)} disabled={saving}
                          className="px-2.5 py-1.5 text-[11px] bg-white/5 hover:bg-white/10 text-gray-400 hover:text-yellow-400 rounded transition-colors">
                          📧 Link
                        </button>
                        <button onClick={() => setModal({ mode: 'confirm_deactivate', user: u })}
                          className="px-2.5 py-1.5 text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors">
                          Desativar
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setModal({ mode: 'confirm_reactivate', user: u })}
                        className="px-2.5 py-1.5 text-[11px] bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-colors">
                        Reativar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-2.5 border-t border-white/5 text-[11px] text-gray-600">
          {filtered.length} de {users.length} usuário(s)
        </div>
      </div>

      {/* ─── MODALS ─── */}

      {/* Create user */}
      {modal?.mode === 'create' && (
        <Modal title="Novo Usuário" onClose={() => setModal(null)}>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
            💡 Anote a senha e entregue ao colaborador de forma segura. O login é imediato após a criação.
          </div>
          <Field label="Nome completo">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: João Silva"
              className={inputCls} />
            <Help>Aparece no sidebar e no histórico de edições. Use nome real para facilitar identificação.</Help>
          </Field>
          <Field label="E-mail *">
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="joao@empresa.com"
              className={inputCls} />
            <Help>E-mail corporativo. Será o login do usuário. Não pode ser alterado depois.</Help>
          </Field>
          <Field label="Senha inicial *">
            <PasswordInput value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} show={showPass} onToggle={() => setShowPass(s => !s)} />
            <Help>Mínimo 8 caracteres. O usuário pode alterar depois via "Esqueci minha senha".</Help>
          </Field>
          <RoleSelector value={form.role} onChange={r => setForm(f => ({ ...f, role: r }))} />
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button onClick={saveCreate} disabled={saving}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-gray-900 font-semibold text-sm rounded-lg transition-colors">
              {saving ? 'Criando…' : 'Criar Usuário'}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit user */}
      {modal?.mode === 'edit' && modal.user && (
        <Modal title={`Editar — ${modal.user.name ?? modal.user.email}`} onClose={() => setModal(null)}>
          <Field label="Nome completo">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo"
              className={inputCls} />
          </Field>
          <div>
            <label className="block text-xs text-gray-400 mb-1">E-mail</label>
            <p className="text-sm text-gray-500 bg-gray-800/50 border border-white/5 rounded-lg px-3 py-2">{modal.user.email}</p>
            <Help>O e-mail não pode ser alterado após a criação.</Help>
          </div>
          <RoleSelector value={form.role} onChange={r => setForm(f => ({ ...f, role: r }))} />
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button onClick={saveEdit} disabled={saving}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-gray-900 font-semibold text-sm rounded-lg transition-colors">
              {saving ? 'Salvando…' : 'Salvar Alterações'}
            </button>
          </div>
        </Modal>
      )}

      {/* Set password */}
      {modal?.mode === 'password' && modal.user && (
        <Modal title={`Redefinir Senha — ${modal.user.name ?? modal.user.email}`} onClose={() => setModal(null)}>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-300">
            ⚠️ A senha antiga deixa de funcionar imediatamente. Comunique a nova senha ao usuário.
          </div>
          <Field label="Nova senha *">
            <PasswordInput value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} show={showPass} onToggle={() => setShowPass(s => !s)} />
            <Help>Mínimo 8 caracteres. Recomende ao usuário que troque após o primeiro acesso.</Help>
          </Field>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button onClick={savePassword} disabled={saving}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-gray-900 font-semibold text-sm rounded-lg transition-colors">
              {saving ? 'Alterando…' : 'Alterar Senha'}
            </button>
          </div>
        </Modal>
      )}

      {/* Reset link */}
      {modal?.mode === 'reset_link' && modal.user && (
        <Modal title="Link de Recuperação de Senha" onClose={() => setModal(null)}>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-xs text-green-300">
            ✅ Link gerado com sucesso para <strong>{modal.user.email}</strong>. Copie e envie ao usuário. Válido por 1 hora.
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Link de redefinição</label>
            <div className="flex gap-2">
              <input readOnly value={resetLink} className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none" />
              <button
                onClick={() => { navigator.clipboard.writeText(resetLink); showToast('📋 Link copiado!'); }}
                className="px-3 py-2 bg-white/10 hover:bg-white/15 text-gray-300 text-xs rounded-lg transition-colors">
                Copiar
              </button>
            </div>
            <Help>O usuário acessa este link, define uma nova senha e já fica logado.</Help>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-300 hover:text-white">Fechar</button>
          </div>
        </Modal>
      )}

      {/* Confirm deactivate */}
      {modal?.mode === 'confirm_deactivate' && modal.user && (
        <Modal title="Desativar Usuário" onClose={() => setModal(null)}>
          <p className="text-sm text-gray-300">
            <strong className="text-white">{modal.user.name ?? modal.user.email}</strong> perderá acesso imediatamente ao sistema.
          </p>
          <p className="text-sm text-gray-500">
            O histórico de atividades e os dados são mantidos. Você pode reativar a qualquer momento.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button onClick={() => deactivate(modal.user!)} disabled={saving}
              className="px-5 py-2 bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white font-semibold text-sm rounded-lg transition-colors">
              {saving ? 'Desativando…' : 'Confirmar Desativação'}
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm reactivate */}
      {modal?.mode === 'confirm_reactivate' && modal.user && (
        <Modal title="Reativar Usuário" onClose={() => setModal(null)}>
          <p className="text-sm text-gray-300">
            <strong className="text-white">{modal.user.name ?? modal.user.email}</strong> voltará a ter acesso ao sistema com o perfil <strong className="text-white">{ROLE_LABELS[modal.user.role]}</strong>.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button onClick={() => reactivate(modal.user!)} disabled={saving}
              className="px-5 py-2 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white font-semibold text-sm rounded-lg transition-colors">
              {saving ? 'Reativando…' : 'Confirmar Reativação'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

const inputCls = 'w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500';

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1 font-medium">{label}</label>
      {children}
    </div>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-gray-600 mt-1">{children}</p>;
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">{children}</div>;
}

function PasswordInput({ value, onChange, show, onToggle }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        placeholder="Mínimo 8 caracteres" className={`${inputCls} pr-10`} />
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">
        {show ? '🙈' : '👁'}
      </button>
    </div>
  );
}

function RoleSelector({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const ROLES: Role[] = ['director', 'finance', 'manager', 'collaborator'];
  const ROLE_ACCESS: Record<Role, string[]> = {
    director: ['Acesso total', 'Painel Admin', 'P&L / KPIs', 'Portfólio completo'],
    finance: ['Dashboard / P&L / KPIs', 'Custos e Faturamento', 'Projetos (leitura)', 'Wiki'],
    manager: ['Projetos / Pipeline', 'Lançar horas', 'Capacity Forecast', 'Wiki'],
    collaborator: ['Somente Wiki / Intranet'],
  };
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-2 font-medium">Perfil de Acesso *</label>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map(r => (
          <button key={r} type="button" onClick={() => onChange(r)}
            className={`p-3 rounded-xl border text-left transition-all ${value === r ? `${ROLE_COLORS[r]} border-opacity-100` : 'bg-gray-800 border-white/10 hover:border-white/20'}`}>
            <p className="text-xs font-semibold">{ROLE_LABELS[r]}</p>
            <p className="text-[10px] text-gray-500 mt-1 leading-snug">{ROLE_ACCESS[r][0]}</p>
          </button>
        ))}
      </div>
      <div className="mt-2 bg-gray-800/50 rounded-lg p-3">
        <p className="text-[11px] text-gray-500 font-medium mb-1">Permissões deste perfil:</p>
        <ul className="space-y-0.5">
          {ROLE_ACCESS[value].map((a, i) => (
            <li key={i} className="text-[11px] text-gray-400">✓ {a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
