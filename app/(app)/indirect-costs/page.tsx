'use client';

import { useEffect, useState, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import FieldHelp from '@/components/ui/FieldHelp';
import InfoBox from '@/components/ui/InfoBox';

interface IndirectCost {
  id: string;
  name: string;
  category: string;
  description: string | null;
  amount: number;
  period_month: number;
  period_year: number;
  rateio_scope: string;
}

const CATEGORIES = [
  { value: 'office',    label: 'Escritório / Infra',    icon: '🏢' },
  { value: 'hr',        label: 'RH / Benefícios',       icon: '👥' },
  { value: 'software',  label: 'Software / Licenças',   icon: '💻' },
  { value: 'marketing', label: 'Marketing / Vendas',    icon: '📢' },
  { value: 'finance',   label: 'Financeiro / Contábil', icon: '📊' },
  { value: 'other',     label: 'Outros SGA',            icon: '📦' },
];

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const now = new Date();
const emptyForm = {
  name: '', category: 'office', description: '',
  amount: '', period_month: String(now.getMonth() + 1),
  period_year: String(now.getFullYear()), rateio_scope: 'all',
};

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0);
}

export default function IndirectCostsPage() {
  const [costs, setCosts] = useState<IndirectCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IndirectCost | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1));

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/indirect-costs?year=${filterYear}&month=${filterMonth}`);
    setCosts(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [filterYear, filterMonth]); // eslint-disable-line

  function openNew() { setEditing(null); setForm({ ...emptyForm, period_month: filterMonth, period_year: filterYear }); setModalOpen(true); }

  function openEdit(c: IndirectCost) {
    setEditing(c);
    setForm({
      name: c.name, category: c.category, description: c.description ?? '',
      amount: String(c.amount), period_month: String(c.period_month),
      period_year: String(c.period_year), rateio_scope: c.rateio_scope,
    });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = {
      ...form,
      amount: Number(form.amount),
      period_month: Number(form.period_month),
      period_year: Number(form.period_year),
      description: form.description || null,
    };
    const url = editing ? `/api/indirect-costs/${editing.id}` : '/api/indirect-costs';
    const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const e = await res.json(); alert(e.error); }
    setSaving(false); setModalOpen(false); load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir este custo indireto?')) return;
    await fetch(`/api/indirect-costs/${id}`, { method: 'DELETE' });
    load();
  }

  const totalMonth = costs.reduce((s, c) => s + Number(c.amount), 0);
  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    costs.forEach(c => { m[c.category] = (m[c.category] ?? 0) + Number(c.amount); });
    return m;
  }, [costs]);

  const years = Array.from({ length: 4 }, (_, i) => String(now.getFullYear() - i));

  return (
    <div className="p-8">
      <InfoBox icon="🧾" title="Para que serve este menu?">
        <p>Registra os <strong className="text-white">custos indiretos da operação (SGA)</strong> — despesas que não são atribuídas diretamente a um projeto mas que fazem parte do custo real do negócio: aluguel, folha administrativa, licenças corporativas, contabilidade.</p>
        <p className="mt-1">Esses custos são cadastrados mensalmente e podem ser <strong className="text-white">rateados</strong> entre todos os projetos ativos, dando uma visão da <strong className="text-white">margem líquida real</strong> — não só a margem bruta.</p>
        <p className="mt-1 text-gray-500">Dica: cadastre no início de cada mês com os valores recorrentes. O rateio é calculado automaticamente no P&amp;L por Conta.</p>
      </InfoBox>

      <PageHeader
        title="Custos Indiretos (SGA)"
        description="Despesas administrativas e de suporte rateadas entre os projetos"
        action={
          <button onClick={openNew} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity">
            + Novo Custo
          </button>
        }
      />

      {/* Filtro de período */}
      <div className="flex items-center gap-3 mb-6">
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
          className="bg-gray-900/70 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
          {MONTHS.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="bg-gray-900/70 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-gray-600 text-sm">·</span>
        <span className="text-sm text-gray-400">Total do mês: <strong className="text-red-400">{fmt(totalMonth)}</strong></span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Category breakdown */}
        <div className="bg-gray-900/70 border border-white/5 rounded-2xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Por Categoria</p>
          <div className="space-y-3">
            {CATEGORIES.map(cat => {
              const val = byCategory[cat.value] ?? 0;
              const pct = totalMonth > 0 ? (val / totalMonth) * 100 : 0;
              return (
                <div key={cat.value}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{cat.icon} {cat.label}</span>
                    <span className="text-xs font-bold text-white tabular-nums">{fmt(val)}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1">
                    <div className="h-1 rounded-full bg-gradient-to-r from-cyan-500 to-green-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-white/5 flex justify-between">
              <span className="text-xs text-gray-500">Total SGA</span>
              <span className="text-sm font-bold text-red-400">{fmt(totalMonth)}</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="xl:col-span-3">
          {loading ? (
            <p className="text-gray-500 text-sm">Carregando...</p>
          ) : costs.length === 0 ? (
            <div className="text-center py-20 text-gray-600 bg-gray-900/70 border border-white/5 rounded-2xl">
              <p className="text-4xl mb-3">🧾</p>
              <p className="text-sm">Nenhum custo indireto para {MONTHS[Number(filterMonth) - 1]}/{filterYear}.</p>
              <button onClick={openNew} className="mt-3 text-cyan-400 text-sm hover:underline">Lançar primeiro custo</button>
            </div>
          ) : (
            <div className="bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-gray-600 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Nome / Categoria</th>
                    <th className="text-left px-4 py-3">Descrição</th>
                    <th className="text-left px-4 py-3">Escopo Rateio</th>
                    <th className="text-right px-4 py-3 text-red-400">Valor</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((c) => {
                    const cat = CATEGORIES.find(x => x.value === c.category) ?? CATEGORIES[5];
                    return (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-white text-sm">{c.name}</p>
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                            {cat.icon} {cat.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-400">{c.description ?? '—'}</td>
                        <td className="px-4 py-4">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                            {c.rateio_scope === 'all' ? 'Todos os projetos' : c.rateio_scope === 'client' ? 'Por cliente' : 'Por grupo'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-red-400 tabular-nums">{fmt(c.amount)}</td>
                        <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(c)} className="text-xs text-gray-500 hover:text-white mr-3">Editar</button>
                          <button onClick={() => remove(c.id)} className="text-xs text-gray-500 hover:text-red-400">Excluir</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 bg-gray-900/40">
                    <td colSpan={3} className="px-6 py-3 text-xs text-gray-500">{costs.length} lançamento{costs.length !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-400 tabular-nums">{fmt(totalMonth)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Custo Indireto' : 'Novo Custo Indireto'}>
        <div className="space-y-5">
          <InfoBox icon="💡" title="O que são custos indiretos?" variant="tip">
            <p>São despesas da empresa que <strong className="text-white">não pertencem a um único projeto</strong>, mas existem para que todos os projetos possam ser entregues. Ex: aluguel do escritório, plano de saúde da equipe, software de gestão.</p>
          </InfoBox>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nome do Custo *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Aluguel do escritório"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
            <FieldHelp text="Nome que identifica este custo nos relatórios. Ex: 'Aluguel Sede', 'Plano de Saúde Equipe', 'Licença Microsoft 365'." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Categoria *</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button" onClick={() => setForm({ ...form, category: cat.value })}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all ${form.category === cat.value ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
            <FieldHelp text="Classifica o custo para análise da composição do SGA. Escritório: aluguel, condomínio, limpeza. RH: benefícios, treinamentos. Software: ferramentas corporativas." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Mês de Competência *</label>
              <select value={form.period_month} onChange={(e) => setForm({ ...form, period_month: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                {MONTHS.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
              </select>
              <FieldHelp text="Mês ao qual esta despesa se refere (competência, não necessariamente pagamento)." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Ano *</label>
              <select value={form.period_year} onChange={(e) => setForm({ ...form, period_year: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Valor (R$) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="5000"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white font-semibold focus:outline-none focus:border-cyan-500" />
            </div>
            <FieldHelp text="Valor mensal deste custo em reais. Para custos anuais (ex: seguro), divida por 12 e lance mensalmente." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Escopo de Rateio</label>
            <select value={form.rateio_scope} onChange={(e) => setForm({ ...form, rateio_scope: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
              <option value="all">Todos os projetos ativos (rateio igualitário)</option>
              <option value="client">Vinculado a cliente específico</option>
              <option value="group">Vinculado a grupo/holding específico</option>
            </select>
            <FieldHelp text="Define como este custo será distribuído no P&L. 'Todos os projetos' divide igualmente entre projetos ativos. 'Por cliente' ou 'por grupo' atribui o custo diretamente a uma conta específica." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descrição</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalhe adicional do custo..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
            <FieldHelp text="Informações adicionais para referência futura. Ex: número da NF, fornecedor, contrato vigente." />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name || !form.amount}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium">
              {saving ? 'Salvando...' : 'Salvar Custo'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
