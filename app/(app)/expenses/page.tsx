'use client';

import { useEffect, useState, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import FieldHelp from '@/components/ui/FieldHelp';
import InfoBox from '@/components/ui/InfoBox';

interface Project { id: string; name: string; }
interface Expense {
  id: string;
  project_id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  project: { id: string; name: string } | null;
}

const CATEGORIES = [
  { value: 'software',    label: 'Licença de Software',   icon: '💻' },
  { value: 'travel',      label: 'Viagem / Deslocamento',  icon: '✈️' },
  { value: 'contractor',  label: 'Contratado / PJ',        icon: '🤝' },
  { value: 'hardware',    label: 'Hardware / Infra',       icon: '🖥️' },
  { value: 'marketing',   label: 'Marketing / Materiais',  icon: '📢' },
  { value: 'other',       label: 'Outros',                 icon: '📦' },
];

const emptyForm = {
  project_id: '', category: 'software', description: '',
  amount: '', expense_date: new Date().toISOString().split('T')[0],
};

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0);
}

function categoryLabel(v: string) {
  return CATEGORIES.find(c => c.value === v) ?? { label: v, icon: '📦' };
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterProject, setFilterProject] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  async function load() {
    setLoading(true);
    const [eRes, pRes] = await Promise.all([
      fetch('/api/expenses'),
      fetch('/api/projects'),
    ]);
    setExpenses(await eRes.json());
    setProjects(await pRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true); }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      project_id: e.project_id,
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      expense_date: e.expense_date,
    });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = {
      ...form,
      amount: Number(form.amount),
      project_id: form.project_id || null,
    };
    const url = editing ? `/api/expenses/${editing.id}` : '/api/expenses';
    const method = editing ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); alert(err.error); }
    setSaving(false); setModalOpen(false); load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta despesa?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    load();
  }

  const filtered = useMemo(() => expenses.filter(e => {
    if (filterProject && e.project_id !== filterProject) return false;
    if (filterCategory && e.category !== filterCategory) return false;
    return true;
  }), [expenses, filterProject, filterCategory]);

  const totalByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + Number(e.amount); });
    return map;
  }, [expenses]);

  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="p-8">
      <InfoBox icon="💳" title="Para que serve este menu?">
        <p>Registra <strong className="text-white">custos diretos de projeto que não são horas de equipe</strong>: licenças de software, viagens, hospedagem, contratação pontual de freelancers PJ, hardware, materiais.</p>
        <p className="mt-1">Cada despesa lançada aqui é <strong className="text-white">descontada da margem do projeto imediatamente</strong>, garantindo que o P&amp;L reflita o custo real — não apenas o esforço da equipe.</p>
        <p className="mt-1 text-gray-500">Exemplo: o projeto tem budget de R$ 60K. Já gastou R$ 35K em horas. Você contrata um dev freelancer por R$ 8K → a margem cai para R$ 17K automaticamente, sem precisar recalcular nada.</p>
      </InfoBox>

      <PageHeader
        title="Despesas Extras"
        description="Licenças, viagens, contratados PJ — custo real além das horas"
        action={
          <button onClick={openNew} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity">
            + Nova Despesa
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
        {/* Category breakdown */}
        <div className="xl:col-span-1 bg-gray-900/70 border border-white/5 rounded-2xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Por Categoria</p>
          <div className="space-y-3">
            {CATEGORIES.map(cat => {
              const val = totalByCategory[cat.value] ?? 0;
              const pct = totalAll > 0 ? (val / totalAll) * 100 : 0;
              return (
                <button
                  key={cat.value}
                  onClick={() => setFilterCategory(filterCategory === cat.value ? '' : cat.value)}
                  className={`w-full text-left rounded-lg p-2.5 transition-colors ${filterCategory === cat.value ? 'bg-cyan-500/10 border border-cyan-500/30' : 'hover:bg-white/5'}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-300">{cat.icon} {cat.label}</span>
                    <span className="text-xs font-bold text-white tabular-nums">{fmt(val)}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1">
                    <div className="h-1 rounded-full bg-gradient-to-r from-cyan-500 to-green-500" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
            <div className="pt-2 border-t border-white/5 flex justify-between items-center">
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-sm font-bold text-red-400">{fmt(totalAll)}</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="xl:col-span-3">
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
              className="bg-gray-900/70 border border-white/5 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500">
              <option value="">Todos os projetos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {(filterProject || filterCategory) && (
              <button onClick={() => { setFilterProject(''); setFilterCategory(''); }}
                className="text-xs text-gray-500 hover:text-white px-3 py-2 bg-gray-800 rounded-lg">
                Limpar filtros
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-600 bg-gray-900/70 border border-white/5 rounded-2xl">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-sm">{filterProject || filterCategory ? 'Nenhuma despesa com esses filtros.' : 'Nenhuma despesa lançada.'}</p>
              {!filterProject && !filterCategory && (
                <button onClick={openNew} className="mt-3 text-cyan-400 text-sm hover:underline">Lançar primeira despesa</button>
              )}
            </div>
          ) : (
            <div className="bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-gray-600 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Data</th>
                    <th className="text-left px-4 py-3">Categoria</th>
                    <th className="text-left px-4 py-3">Projeto</th>
                    <th className="text-left px-4 py-3">Descrição</th>
                    <th className="text-right px-4 py-3 text-red-400">Valor</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const cat = categoryLabel(e.category);
                    return (
                      <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-3 text-gray-400 tabular-nums text-xs">
                          {new Date(e.expense_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-full">
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{e.project?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-300">{e.description}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-400 tabular-nums">
                          {fmt(e.amount)}
                        </td>
                        <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(e)} className="text-xs text-gray-500 hover:text-white mr-3">Editar</button>
                          <button onClick={() => remove(e.id)} className="text-xs text-gray-500 hover:text-red-400">Excluir</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 bg-gray-900/40">
                    <td colSpan={4} className="px-6 py-3 text-xs text-gray-500 uppercase tracking-wide">
                      {filtered.length} despesa{filtered.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-400 text-sm tabular-nums">
                      {fmt(filtered.reduce((s, e) => s + Number(e.amount), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Despesa' : 'Nova Despesa'}>
        <div className="space-y-5">
          <InfoBox icon="💡" title="Dica de preenchimento" variant="tip">
            <p>Seja específico na descrição — este campo aparece nos relatórios de auditoria e ajuda a entender onde o dinheiro foi gasto meses depois.</p>
          </InfoBox>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Projeto</label>
            <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
              <option value="">Sem projeto específico (custo geral)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <FieldHelp text="Projeto ao qual esta despesa será atribuída. A despesa reduz a margem do projeto imediatamente no P&L. Se for um custo operacional geral sem projeto específico (ex: renovação de domínio), deixe em branco." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Categoria *</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button"
                  onClick={() => setForm({ ...form, category: cat.value })}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all ${
                    form.category === cat.value
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <FieldHelp text="Classifica a despesa para fins de relatório e análise. Licença de Software: assinaturas de ferramentas e plataformas. Viagem: passagens, hospedagem, alimentação em campo. Contratado/PJ: freelancers e consultores externos pontuais. Hardware/Infra: equipamentos, servidores, cloud. Marketing: materiais, eventos, brindes. Outros: despesas que não se encaixam nas anteriores." />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Data *</label>
              <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
              <FieldHelp text="Data em que a despesa foi incorrida — preferencialmente a data da nota fiscal ou do pagamento. Usada para análise temporal dos custos." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Valor (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0,00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white font-semibold focus:outline-none focus:border-cyan-500" />
              </div>
              <FieldHelp text="Valor total da despesa em reais. Para despesas em moeda estrangeira, converta pela cotação do dia do pagamento." />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descrição *</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Licença AWS março/2025, Passagem aérea SP-RJ reunião cliente, Contrato dev freelancer Sprint 3"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
            <FieldHelp text="Detalhe do gasto — quanto mais específico, melhor. Este campo aparece nos relatórios de auditoria e ajuda a entender a origem de cada custo meses depois. Exemplos: 'Licença Figma anual', 'Hotel 3 noites workshop Tambasa', 'Dev freelancer React — 40h Sprint 5'." />
          </div>

          {form.amount && form.project_id && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
              <strong>{fmt(Number(form.amount))}</strong> será descontado da margem do projeto imediatamente.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving || !form.amount || !form.description}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium transition-opacity">
              {saving ? 'Salvando...' : 'Lançar Despesa'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
