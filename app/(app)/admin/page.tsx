'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

const ROLE_ACCESS_SUMMARY: Record<Role, { menus: string[]; color: string }> = {
  director: {
    menus: ['Dashboard', 'P&L', 'Faturamento', 'Capacity', 'KPIs', 'Portfólio completo', 'Financeiro completo', 'Colaboradores', 'Wiki', 'Admin'],
    color: 'from-yellow-500/20 to-orange-500/10',
  },
  finance: {
    menus: ['Dashboard', 'P&L', 'Faturamento', 'KPIs', 'Clientes (leitura)', 'Projetos (leitura)', 'Custos Indiretos', 'Despesas', 'Colaboradores (sem custo H/H)', 'Wiki'],
    color: 'from-blue-500/20 to-cyan-500/10',
  },
  manager: {
    menus: ['Capacity Forecast', 'Clientes (leitura)', 'Projetos', 'Pipeline', 'Lançar / Importar horas', 'Despesas', 'Colaboradores (sem custo H/H)', 'Wiki'],
    color: 'from-green-500/20 to-emerald-500/10',
  },
  collaborator: {
    menus: ['Wiki / Intranet (somente leitura)'],
    color: 'from-gray-500/20 to-gray-500/10',
  },
};

export default function AdminHomePage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(data => {
      setUsers(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const active = users.filter(u => u.active);
  const inactive = users.filter(u => !u.active);
  const byRole = ROLES.map(r => ({ role: r, users: active.filter(u => u.role === r) }));

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🔐 Painel de Administração</h1>
        <p className="text-sm text-gray-400 mt-1">
          Visão geral do sistema, usuários ativos e matriz de permissões por perfil.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Usuários Ativos</p>
          <p className="text-3xl font-bold text-white">{active.length}</p>
          {inactive.length > 0 && <p className="text-[11px] text-gray-600 mt-1">{inactive.length} inativo(s)</p>}
        </div>
        {byRole.slice(0, 3).map(({ role, users: rus }) => (
          <div key={role} className="bg-gray-900 border border-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{ROLE_LABELS[role]}</p>
            <p className="text-3xl font-bold text-white">{rus.length}</p>
            <p className="text-[11px] text-gray-600 mt-1">{rus.length === 0 ? 'nenhum cadastrado' : rus.map(u => u.name ?? u.email.split('@')[0]).slice(0, 2).join(', ')}</p>
          </div>
        ))}
      </div>

      {/* Quick action */}
      <div className="flex gap-3">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          👥 Gerenciar Usuários
        </Link>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          + Adicionar Usuário
        </Link>
      </div>

      {/* Users by role */}
      {!loading && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-4">👤 Usuários por Perfil</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {byRole.map(({ role, users: rus }) => (
              <div key={role} className={`bg-gradient-to-br ${ROLE_ACCESS_SUMMARY[role].color} border border-white/8 rounded-xl overflow-hidden`}>
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
                    <span className="text-sm text-gray-500">{rus.length} {rus.length === 1 ? 'usuário' : 'usuários'}</span>
                  </div>
                </div>

                {/* Users in role */}
                {rus.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {rus.map(u => (
                      <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
                          {(u.name ?? u.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate">{u.name ?? u.email.split('@')[0]}</p>
                          <p className="text-[11px] text-gray-600 truncate">{u.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-4 text-[11px] text-gray-600 italic">Nenhum usuário neste perfil.</div>
                )}

                {/* Access list */}
                <div className="px-5 py-3 border-t border-white/5">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Menus acessíveis</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLE_ACCESS_SUMMARY[role].menus.map((m, i) => (
                      <span key={i} className="text-[10px] bg-white/5 text-gray-500 px-2 py-0.5 rounded">{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permissions matrix */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-4">🗂️ Matriz de Permissões</p>
        <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="border-b border-white/5">
              <tr>
                <th className="px-5 py-3 text-left text-gray-500 font-medium">Módulo / Página</th>
                {ROLES.map(r => (
                  <th key={r} className="px-3 py-3 text-center">
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded border font-semibold ${ROLE_COLORS[r]}`}>
                      {ROLE_LABELS[r].split(' ').slice(1).join(' ')}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { label: 'Visão Executiva (Dashboard)', access: [true, true, false, false] },
                { label: 'P&L por Conta', access: [true, true, false, false] },
                { label: 'Faturamento', access: [true, true, false, false] },
                { label: 'Capacity Forecast', access: [true, false, true, false] },
                { label: 'KPIs Financeiros', access: [true, true, false, false] },
                { label: 'Grupos / Contas', access: [true, 'r', false, false] },
                { label: 'Clientes', access: [true, 'r', 'r', false] },
                { label: 'Projetos', access: [true, 'r', true, false] },
                { label: 'Pipeline', access: [true, false, true, false] },
                { label: 'Lançar / Importar Horas', access: [true, false, true, false] },
                { label: 'Custos Indiretos (SGA)', access: [true, true, false, false] },
                { label: 'Despesas Extra', access: [true, true, true, false] },
                { label: 'Colaboradores + Custo H/H', access: [true, 'r*', 'r*', false] },
                { label: 'Wiki (leitura)', access: [true, true, true, true] },
                { label: 'Wiki (criar/editar)', access: [true, true, true, false] },
                { label: 'Admin — Usuários & Acessos', access: [true, false, false, false] },
              ].map(({ label, access }) => (
                <tr key={label} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-2.5 text-gray-400">{label}</td>
                  {access.map((a, i) => (
                    <td key={i} className="px-3 py-2.5 text-center">
                      {a === true ? (
                        <span className="text-green-400 font-bold">✓</span>
                      ) : a === 'r' ? (
                        <span className="text-blue-400 text-[10px] font-medium">👁 leitura</span>
                      ) : a === 'r*' ? (
                        <span className="text-blue-400 text-[10px] font-medium">👁 sem R$</span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-white/5 flex gap-4 text-[10px] text-gray-600">
            <span><span className="text-green-400 font-bold">✓</span> Acesso total</span>
            <span><span className="text-blue-400 font-medium">👁 leitura</span> Só visualização</span>
            <span><span className="text-blue-400 font-medium">👁 sem R$</span> Vê colaboradores mas não custo H/H</span>
            <span><span className="text-gray-700">—</span> Sem acesso</span>
          </div>
        </div>
      </div>
    </div>
  );
}
