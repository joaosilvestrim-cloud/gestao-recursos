'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface Entry {
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
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function BalancoPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/financial/entries')
      .then(r => r.json())
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const rec = entries.filter(e => e.type === 'receivable');
    const pay = entries.filter(e => e.type === 'payable');

    const totalRec   = rec.filter(e => e.effective_status !== 'paid').reduce((s, e) => s + e.amount, 0);
    const totalPay   = pay.filter(e => e.effective_status !== 'paid').reduce((s, e) => s + e.amount, 0);
    const recOverdue = rec.filter(e => e.effective_status === 'overdue').reduce((s, e) => s + e.amount, 0);
    const payOverdue = pay.filter(e => e.effective_status === 'overdue').reduce((s, e) => s + e.amount, 0);
    const recThisMonth = rec.filter(e => e.status === 'paid' && e.paid_date && e.paid_date >= monthStart && e.paid_date <= monthEnd).reduce((s, e) => s + e.amount, 0);
    const payThisMonth = pay.filter(e => e.status === 'paid' && e.paid_date && e.paid_date >= monthStart && e.paid_date <= monthEnd).reduce((s, e) => s + e.amount, 0);

    return { totalRec, totalPay, recOverdue, payOverdue, recThisMonth, payThisMonth,
      net: totalRec - totalPay, netThisMonth: recThisMonth - payThisMonth };
  }, [entries, monthStart, monthEnd]);

  // Next 30 days events
  const upcoming = useMemo(() => {
    const limit = new Date(today); limit.setDate(limit.getDate() + 30);
    const limitStr = limit.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);
    return entries
      .filter(e => e.effective_status === 'pending' && e.due_date >= todayStr && e.due_date <= limitStr)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 12);
  }, [entries, today]);

  // Monthly summary last 6 months
  const monthlySummary = useMemo(() => {
    const months: { key: string; label: string; rec: number; pay: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const rec = entries.filter(e => e.type === 'receivable' && e.status === 'paid' && e.paid_date?.startsWith(key)).reduce((s, e) => s + e.amount, 0);
      const pay = entries.filter(e => e.type === 'payable'    && e.status === 'paid' && e.paid_date?.startsWith(key)).reduce((s, e) => s + e.amount, 0);
      months.push({ key, label, rec, pay });
    }
    return months;
  }, [entries, today]);

  const maxBar = Math.max(...monthlySummary.flatMap(m => [m.rec, m.pay]), 1);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">⚖️ Balanço Geral</h1>
          <p className="text-sm text-gray-400 mt-1">Visão consolidada de entradas, saídas e posição líquida.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/financeiro/receber" className="px-4 py-2 bg-green-500/15 hover:bg-green-500/25 text-green-400 text-sm rounded-xl transition-colors border border-green-500/20">
            + Receber
          </Link>
          <Link href="/financeiro/pagar" className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm rounded-xl transition-colors border border-red-500/20">
            + Pagar
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net position */}
        <div className={`lg:col-span-2 rounded-2xl p-5 border ${stats.net >= 0 ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20' : 'bg-gradient-to-br from-red-500/10 to-rose-500/5 border-red-500/20'}`}>
          <p className="text-xs text-gray-500 mb-1">Posição Líquida (pendente)</p>
          <p className={`text-3xl font-bold ${stats.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(stats.net)}</p>
          <p className="text-xs text-gray-600 mt-1">{stats.net >= 0 ? '✅ Saldo positivo' : '⚠️ Mais a pagar do que a receber'}</p>
        </div>

        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">A Receber</p>
          <p className="text-2xl font-bold text-white">{fmt(stats.totalRec)}</p>
          {stats.recOverdue > 0 && <p className="text-xs text-red-400 mt-1">⚠️ {fmt(stats.recOverdue)} vencidos</p>}
        </div>

        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">A Pagar</p>
          <p className="text-2xl font-bold text-white">{fmt(stats.totalPay)}</p>
          {stats.payOverdue > 0 && <p className="text-xs text-red-400 mt-1">⚠️ {fmt(stats.payOverdue)} vencidos</p>}
        </div>
      </div>

      {/* Month performance */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">Recebido este mês</p>
          <p className="text-xl font-bold text-green-400">{fmt(stats.recThisMonth)}</p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">Pago este mês</p>
          <p className="text-xl font-bold text-red-400">{fmt(stats.payThisMonth)}</p>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-1">Resultado do mês</p>
          <p className={`text-xl font-bold ${stats.netThisMonth >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(stats.netThisMonth)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly bar chart */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <p className="text-sm font-semibold text-white mb-5">📊 Histórico — últimos 6 meses</p>
          <div className="space-y-4">
            {monthlySummary.map(m => (
              <div key={m.key}>
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
                  <span className="capitalize">{m.label}</span>
                  <span className={m.rec - m.pay >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {m.rec - m.pay >= 0 ? '+' : ''}{fmt(m.rec - m.pay)}
                  </span>
                </div>
                <div className="flex gap-1 h-5">
                  <div className="flex-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500/60 rounded-full transition-all"
                      style={{ width: `${maxBar > 0 ? (m.rec / maxBar) * 100 : 0}%` }} />
                  </div>
                  <div className="flex-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500/60 rounded-full transition-all"
                      style={{ width: `${maxBar > 0 ? (m.pay / maxBar) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-700 mt-0.5">
                  <span>📥 {fmt(m.rec)}</span>
                  <span>📤 {fmt(m.pay)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-[11px] text-gray-600">
            <span><span className="text-green-400">■</span> Recebimentos</span>
            <span><span className="text-red-400">■</span> Pagamentos</span>
          </div>
        </div>

        {/* Upcoming 30 days */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <p className="text-sm font-semibold text-white mb-4">📅 Próximos 30 dias</p>
          {upcoming.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm">Nenhum vencimento nos próximos 30 dias.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {upcoming.map(e => (
                <div key={e.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  e.type === 'receivable'
                    ? 'bg-green-500/5 border-green-500/10'
                    : 'bg-red-500/5 border-red-500/10'
                }`}>
                  <span className="text-lg shrink-0">{e.type === 'receivable' ? '📥' : '📤'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-200 truncate">{e.description}</p>
                    {e.party && <p className="text-[11px] text-gray-600 truncate">{e.party}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${e.type === 'receivable' ? 'text-green-400' : 'text-red-400'}`}>{fmt(e.amount)}</p>
                    <p className="text-[10px] text-gray-600">{fmtDate(e.due_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
