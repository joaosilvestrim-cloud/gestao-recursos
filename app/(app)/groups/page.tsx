'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import FieldHelp from '@/components/ui/FieldHelp';
import InfoBox from '@/components/ui/InfoBox';

interface Group { id: string; name: string; description: string | null; }

const empty = { name: '', description: '' };

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/groups');
    setGroups(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    setModalOpen(false);
    load();
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Grupos / Contas"
        description="Guarda-chuva corporativo — Holdings e unidades de negócio que agrupam seus clientes"
        action={
          <button onClick={() => { setForm(empty); setModalOpen(true); }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity">
            + Novo Grupo
          </button>
        }
      />

      <InfoBox icon="🏛️" title="Para que serve este menu?">
        <p>
          Grupos são o nível mais alto da hierarquia financeira do sistema: <strong className="text-white">Grupo → Cliente → Projeto</strong>.
        </p>
        <p className="mt-1">
          Exemplo: o <strong className="text-white">Tambasa Group</strong> é o grupo. Dentro dele existem os clientes
          <em> Tambasa Distribuidora</em> e <em>Tambasa Logística</em>. O sistema consolida a lucratividade de todos os projetos
          desses clientes e apresenta o P&amp;L total do grupo no Command Center.
        </p>
        <p className="mt-1 text-gray-500">
          Crie primeiro os grupos, depois cadastre os clientes vinculados a cada um.
        </p>
      </InfoBox>

      {loading ? <p className="text-gray-500 text-sm mt-6">Carregando...</p> : groups.length === 0 ? (
        <div className="text-center py-20 text-gray-600 mt-6">
          <p className="text-4xl mb-3">🏛️</p>
          <p className="text-sm mb-1">Crie os grupos para organizar suas contas por holding ou unidade de negócio.</p>
          <p className="text-xs text-gray-700">Ex: Tambasa Group, Zenatur, Eagles Group, IUNEX</p>
          <button onClick={() => setModalOpen(true)} className="mt-4 text-cyan-400 text-sm hover:underline">Criar primeiro grupo</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {groups.map((g) => (
            <div key={g.id} className="bg-gray-900/60 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-green-500/20 flex items-center justify-center text-lg">🏛️</div>
                <h2 className="font-semibold text-white">{g.name}</h2>
              </div>
              {g.description && <p className="text-xs text-gray-500">{g.description}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Grupo / Conta">
        <div className="space-y-5">
          <InfoBox icon="💡" title="Como preencher" variant="tip">
            <p>Um grupo representa uma holding ou unidade de negócio. Todos os clientes e projetos vinculados a ele serão consolidados no P&amp;L deste grupo.</p>
          </InfoBox>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nome do Grupo *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Tambasa Group"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
            />
            <FieldHelp text="Nome da holding, grupo empresarial ou unidade de negócio. Use o nome oficial para facilitar o reconhecimento nos relatórios. Ex: 'Tambasa Group', 'Zenatur', 'Eagles Group'." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descrição</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Grupo de distribuição e logística, 3 unidades"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
            />
            <FieldHelp text="Contexto sobre o grupo: segmento de atuação, número de unidades, estrutura societária. Aparece nos relatórios executivos como informação de contexto para o gestor." />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium transition-opacity">
              {saving ? 'Salvando...' : 'Salvar Grupo'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
