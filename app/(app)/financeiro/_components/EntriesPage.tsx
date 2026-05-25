'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';

export interface Entry {
  id: string;
  type: 'receivable' | 'payable';
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  effective_status: string;
  category: string | null;
  party: string | null;
  notes: string | null;
  recurrence: string;
  project?: { id: string; name: string } | null;
}

type StatusFilter = 'all' | 'pending' | 'overdue' | 'paid';

const STATUS_STYLES: Record<string, string> = {
  paid:    'bg-green-500/15 text-green-400 border-green-500/25',
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  overdue: 'bg-red-500/15 text-red-400 border-red-500/25',
};
const STATUS_LABELS: Record<string, string> = {
  paid: '✅ Pago', pending: '⏳ Pendente', overdue: '🔴 Vencido',
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const EMPTY_FORM = {
  description: '', amount: '', due_date: '', paid_date: '',
  category: '', party: '', notes: '', recurrence: 'none',
};

const CATEGORIES_REC = ['Serviços', 'Consultoria', 'Licenciamento', 'Reembolso', 'Outros'];
const CATEGORIES_PAY = ['Fornecedor', 'Folha', 'Aluguel', 'Software', 'Marketing', 'Impostos', 'Outros'];

interface Props {
  entryType: 'receivable' | 'payable';
}

export default function EntriesPage({ entryType }: Props) {
  const isRec = entryType === 'receivable';
  const accent = isRec ? 'cyan' : 'red';
  const CATEGORIES = isRec ? CATEGORIES_REC : CATEGORIES_PAY;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/financial/entries?type=${entryType}`);
    const d = await res.json();
    setEntries(Array.isArray(d) ? d : []);
    setLoading(false);
  }, [entryType]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); }
  }, [toast]);

  const filtered = useMemo(() => {
    let list = entries;
    if (statusFilter !== 'all') list = list.filter(e => e.effective_status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.description.toLowerCase().includes(q) ||
        (e.party ?? '').toLowerCase().includes(q) ||
        (e.category ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [entries, statusFilter, search]);

  const stats = useMemo(() => {
    const pending = entries.filter(e => e.effective_status === 'pending').reduce((s, e) => s + e.amount, 0);
    const overdue = entries.filter(e => e.effective_status === 'overdue').reduce((s, e) => s + e.amount, 0);
    const paid    = entries.filter(e => e.effective_status === 'paid').reduce((s, e) => s + e.amount, 0);
    const total   = entries.filter(e => e.effective_status !== 'paid').reduce((s, e) => s + e.amount, 0);
    return { pending, overdue, paid, total };
  }, [entries]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowModal(true);
  }

  function openEdit(e: Entry) {
    setEditing(e);
    setForm({
      description: e.description, amount: String(e.amount),
      due_date: e.due_date, paid_date: e.paid_date ?? '',
      category: e.category ?? '', party: e.party ?? '',
      notes: e.notes ?? '', recurrence: e.recurrence,
    });
    setError('');
    setShowModal(true);
  }

  async function save() {
    if (!form.description || !form.amount || !form.due_date) {
      setError('Descrição, valor e vencimento são obrigatórios.'); return;
    }
    setSaving(true); setError('');
    const body = {
      type: entryType,
      description: form.description,
      amount: parseFloat(form.amount.replace(',', '.')),
      due_date: form.due_date,
      paid_date: form.paid_date || null,
      status: form.paid_date ? 'paid' : 'pending',
      category: form.category || null,
      party: form.party || null,
      notes: form.notes || null,
      recurrence: form.recurrence,
    };
    const url = editing ? `/api/financial/entries/${editing.id}` : '/api/financial/entries';
    const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar.'); setSaving(false); return; }
    setShowModal(false);
    setToast(editing ? 'Lançamento atualizado!' : `${isRec ? 'Recebimento' : 'Pagamento'} cadastrado!`);
    load();
    setSaving(false);
  }

  async function markPaid(e: Entry) {
    const today = new Date().toISOString().slice(0, 10);
    await fetch(`/api/financial/entries/${e.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', paid_date: today }),
    });
    setToast(isRec ? '✅ Marcado como recebido!' : '✅ Marcado como pago!');
    load();
  }

  async function remove(e: Entry) {
    if (!confirm('Cancelar este lançamento?')) return;
    await fetch(`/api/financial/entries/${e.id}`, { method: 'DELETE' });
    setToast('Lançamento cancelado.');
    load();
  }

  const pendingCount = entries.filter(e => e.effective_status === 'pending').length;
  const overdueCount = entries.filter(e => e.effective_status === 'overdue').length;
  const paidCount    = entries.filter(e => e.effective_status === 'paid').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-800 border border-white/10 text-white text-sm px-4 py-3 rounded-xl shadow-xl animate-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isRec ? '📥 Contas a Receber' : '📤 Contas a Pagar'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {isRec ? 'Gerencie seus recebimentos, datas e status de pagamento dos clientes.' : 'Controle pagamentos a fornecedores, despesas e obrigações financeiras.'}
          </p>
        </div>
        <button onClick={openNew}
          className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            isRec ? 'bg-cyan-500 hover:bg-cyan-400 text-gray-900' : 'bg-red-500 hover:bg-red-400 text-white'
          }`}>
          + Novo {isRec ? 'Recebimento' : 'Pagamento'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total em aberto</p>
          <p className="text-2xl font-bold text-white">{fmt(stats.total)}</p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Pendente</p>
          <p className="text-2xl font-bold text-yellow-400">{fmt(stats.pending)}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{pendingCount} lançamento(s)</p>
        </div>
        <div className="bg-gray-900 border border-red-500/10 bg-red-500/5 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Vencido</p>
          <p className="text-2xl font-bold text-red-400">{fmt(stats.overdue)}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{overdueCount} lançamento(s)</p>
        </div>
        <div className="bg-gray-900 border border-green-500/10 bg-green-500/5 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">{isRec ? 'Recebido' : 'Pago'}</p>
          <p className="text-2xl font-bold text-green-400">{fmt(stats.paid)}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{paidCount} lançamento(s)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-900 border border-white/5 rounded-xl p-1">
          {(['all','pending','overdue','paid'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendentes' : s === 'overdue' ? '🔴 Vencidos' : '✅ Pagos'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar descrição ou cliente…"
            className="w-full bg-gray-900 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
        </div>
        <p className="text-xs text-gray-600 self-center">{filtered.length} resultado(s)</p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-3xl mb-3">{isRec ? '📥' : '📤'}</p>
          <p className="text-lg font-medium text-gray-500">Nenhum lançamento encontrado</p>
          <button onClick={openNew} className="mt-4 text-sm text-cyan-400 hover:underline">
            + Criar primeiro {isRec ? 'recebimento' : 'pagamento'}
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Descrição</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">{isRec ? 'Cliente' : 'Fornecedor'}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">Categoria</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">Valor</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500">Vencimento</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500">{isRec ? 'Recebido em' : 'Pago em'}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-white/2 transition-colors group">
                  <td className="px-5 py-3">
                    <p className="text-gray-200 font-medium truncate max-w-[200px]">{e.description}</p>
                    {e.notes && <p className="text-[11px] text-gray-600 truncate max-w-[200px]">{e.notes}</p>}
                  </td>
                  <td className="px-3 py-3 text-gray-400 text-xs">{e.party ?? '—'}</td>
                  <td className="px-3 py-3">
                    {e.category ? (
                      <span className="text-[11px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{e.category}</span>
                    ) : <span className="text-gray-700">—</span>}
                  </td>
                  <td className={`px-3 py-3 text-right font-bold ${isRec ? 'text-green-400' : 'text-red-400'}`}>
                    {fmt(e.amount)}
                  </td>
                  <td className={`px-3 py-3 text-center text-xs ${e.effective_status === 'overdue' ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                    {fmtDate(e.due_date)}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-400">
                    {e.paid_date ? fmtDate(e.paid_date) : '—'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[e.effective_status] ?? STATUS_STYLES.pending}`}>
                      {STATUS_LABELS[e.effective_status] ?? e.effective_status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {e.effective_status !== 'paid' && (
                        <button onClick={() => markPaid(e)} title={isRec ? 'Marcar recebido' : 'Marcar pago'}
                          className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors text-xs">✅</button>
                      )}
                      <button onClick={() => openEdit(e)} title="Editar"
                        className="p-1.5 text-gray-400 hover:bg-white/5 rounded-lg transition-colors text-xs">✏️</button>
                      <button onClick={() => remove(e)} title="Cancelar"
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-xs">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-white/5">
              <tr>
                <td colSpan={3} className="px-5 py-3 text-xs text-gray-600">
                  {filtered.length} lançamento(s)
                </td>
                <td className={`px-3 py-3 text-right text-sm font-bold ${isRec ? 'text-green-400' : 'text-red-400'}`}>
                  {fmt(filtered.filter(e => e.effective_status !== 'paid').reduce((s, e) => s + e.amount, 0))}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Editar lançamento' : isRec ? '+ Novo Recebimento' : '+ Novo Pagamento'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">{error}</div>}

              <div>
                <label className="block text-xs text-gray-400 mb-1">Descrição <span className="text-red-400">*</span></label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={isRec ? 'Ex: Parcela 1 — Projeto X' : 'Ex: Aluguel de escritório'}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Valor (R$) <span className="text-red-400">*</span></label>
                  <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0,00" type="number" step="0.01" min="0"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Recorrência</label>
                  <select value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-500">
                    <option value="none">Único</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Vencimento <span className="text-red-400">*</span></label>
                  <input value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    type="date"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{isRec ? 'Data do recebimento' : 'Data do pagamento'}</label>
                  <input value={form.paid_date} onChange={e => setForm(f => ({ ...f, paid_date: e.target.value }))}
                    type="date"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{isRec ? 'Cliente' : 'Fornecedor'}</label>
                  <input value={form.party} onChange={e => setForm(f => ({ ...f, party: e.target.value }))}
                    placeholder={isRec ? 'Nome do cliente' : 'Nome do fornecedor'}
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-500">
                    <option value="">Sem categoria</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Observações</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Detalhes adicionais…"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 pb-5">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancelar</button>
              <button onClick={save} disabled={saving}
                className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 ${
                  isRec ? 'bg-cyan-500 hover:bg-cyan-400 text-gray-900' : 'bg-red-500 hover:bg-red-400 text-white'
                }`}>
                {saving ? 'Salvando…' : editing ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
