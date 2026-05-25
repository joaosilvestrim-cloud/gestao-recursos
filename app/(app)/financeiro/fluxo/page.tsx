'use client';

import { useEffect, useState, useMemo } from 'react';

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
function fmtDay(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
function fmtMonth(key: string) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function FluxoCaixaPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');
  const [monthsAhead, setMonthsAhead] = useState(3);

  useEffect(() => {
    fetch('/api/financial/entries')
      .then(r => r.json())
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Build months range: 2 past + current + N future
  const months = useMemo(() => {
    const result: string[] = [];
    for (let i = -2; i <= monthsAhead; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      result.push(d.toISOString().slice(0, 7));
    }
    return result;
  }, [monthsAhead, today]);

  // Group entries by month key (use due_date for pending, paid_date for paid)
  const byMonth = useMemo(() => {
    const map: Record<string, { entries: Entry[]; inflow: number; outflow: number }> = {};
    for (const m of months) {
      map[m] = { entries: [], inflow: 0, outflow: 0 };
    }
    for (const e of entries) {
      const dateKey = (e.status === 'paid' && e.paid_date ? e.paid_date : e.due_date).slice(0, 7);
      if (!map[dateKey]) continue;
      map[dateKey].entries.push(e);
      if (e.type === 'receivable') map[dateKey].inflow += e.amount;
      else map[dateKey].outflow += e.amount;
    }
    return map;
  }, [entries, months]);

  // Cumulative balance
  const withBalance = useMemo(() => {
    let running = 0;
    return months.map(m => {
      const { inflow, outflow, entries: ents } = byMonth[m];
      running += inflow - outflow;
      return { month: m, inflow, outflow, net: inflow - outflow, balance: running, entries: ents };
    });
  }, [months, byMonth]);

  const maxVal = Math.max(...withBalance.flatMap(m => [m.inflow, m.outflow]), 1);

  // Upcoming (next 60 days, not paid)
  const upcoming = useMemo(() => {
    const limit = new Date(today); limit.setDate(limit.getDate() + 60);
    const limitStr = limit.toISOString().slice(0, 10);
    return entries
      .filter(e => e.effective_status !== 'paid' && e.due_date >= todayStr && e.due_date <= limitStr)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [entries, todayStr, today]);

  // Group upcoming by day
  const upcomingByDay = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    for (const e of upcoming) {
      if (!map[e.due_date]) map[e.due_date] = [];
      map[e.due_date].push(e);
    }
    return map;
  }, [upcoming]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">📊 Fluxo de Caixa</h1>
          <p className="text-sm text-gray-400 mt-1">Projeção de entradas e saídas com saldo acumulado por mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-900 border border-white/5 rounded-xl p-1 gap-1">
            <button onClick={() => setView('timeline')}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${view === 'timeline' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              📊 Mensal
            </button>
            <button onClick={() => setView('calendar')}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${view === 'calendar' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              📅 Timeline
            </button>
          </div>
          <select value={monthsAhead} onChange={e => setMonthsAhead(Number(e.target.value))}
            className="bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none">
            <option value={2}>+2 meses</option>
            <option value={3}>+3 meses</option>
            <option value={6}>+6 meses</option>
          </select>
        </div>
      </div>

      {view === 'timeline' ? (
        <>
          {/* Monthly chart */}
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-6 overflow-x-auto">
            <div className="flex gap-3 min-w-[600px]">
              {withBalance.map(m => {
                const isCurrent = m.month === todayStr.slice(0, 7);
                const isFuture = m.month > todayStr.slice(0, 7);
                return (
                  <div key={m.month} className={`flex-1 min-w-[120px] rounded-2xl p-4 border transition-all ${
                    isCurrent ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/5 bg-gray-800/50'
                  }`}>
                    <p className={`text-xs font-semibold mb-3 capitalize ${isCurrent ? 'text-cyan-400' : 'text-gray-400'}`}>
                      {isFuture ? '🔮 ' : ''}{new Date(m.month + '-15').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                      {isCurrent && <span className="ml-1 text-[10px] bg-cyan-500/20 px-1.5 py-0.5 rounded-full">atual</span>}
                    </p>

                    {/* Bar chart */}
                    <div className="flex gap-1 items-end h-16 mb-3">
                      <div className="flex-1 flex items-end">
                        <div className="w-full bg-green-500/60 rounded-t-md transition-all"
                          style={{ height: `${(m.inflow / maxVal) * 60}px`, minHeight: m.inflow > 0 ? 4 : 0 }} />
                      </div>
                      <div className="flex-1 flex items-end">
                        <div className="w-full bg-red-500/60 rounded-t-md transition-all"
                          style={{ height: `${(m.outflow / maxVal) * 60}px`, minHeight: m.outflow > 0 ? 4 : 0 }} />
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-gray-600">📥 Entradas</span>
                        <span className="text-green-400 font-medium">{fmt(m.inflow)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">📤 Saídas</span>
                        <span className="text-red-400 font-medium">{fmt(m.outflow)}</span>
                      </div>
                      <div className="h-px bg-white/5 my-1" />
                      <div className="flex justify-between">
                        <span className="text-gray-500">Resultado</span>
                        <span className={`font-bold ${m.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {m.net >= 0 ? '+' : ''}{fmt(m.net)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Saldo acum.</span>
                        <span className={`font-bold text-xs ${m.balance >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                          {fmt(m.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-4 text-[11px] text-gray-600">
              <span><span className="text-green-400">■</span> Entradas</span>
              <span><span className="text-red-400">■</span> Saídas</span>
              <span><span className="text-cyan-400">■</span> Saldo acumulado</span>
            </div>
          </div>

          {/* Monthly detail table */}
          <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-white/5">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Mês</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">Entradas</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">Saídas</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">Resultado</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">Saldo Acum.</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500">Lançamentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {withBalance.map(m => {
                  const isCurrent = m.month === todayStr.slice(0, 7);
                  return (
                    <tr key={m.month} className={`hover:bg-white/2 transition-colors ${isCurrent ? 'bg-cyan-500/3' : ''}`}>
                      <td className="px-5 py-3">
                        <span className={`font-medium capitalize ${isCurrent ? 'text-cyan-400' : 'text-gray-300'}`}>
                          {fmtMonth(m.month)}
                        </span>
                        {isCurrent && <span className="ml-2 text-[10px] text-cyan-500/70">← atual</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-green-400 font-medium">{fmt(m.inflow)}</td>
                      <td className="px-3 py-3 text-right text-red-400 font-medium">{fmt(m.outflow)}</td>
                      <td className={`px-3 py-3 text-right font-bold ${m.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {m.net >= 0 ? '+' : ''}{fmt(m.net)}
                      </td>
                      <td className={`px-3 py-3 text-right font-bold ${m.balance >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                        {fmt(m.balance)}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-500 text-xs">{m.entries.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Calendar / Timeline view */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">Próximos 60 dias</p>
            {Object.keys(upcomingByDay).length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                <p className="text-3xl mb-2">✅</p>
                <p>Nenhum vencimento nos próximos 60 dias.</p>
              </div>
            ) : (
              Object.entries(upcomingByDay).map(([day, dayEntries]) => {
                const dayRec = dayEntries.filter(e => e.type === 'receivable').reduce((s, e) => s + e.amount, 0);
                const dayPay = dayEntries.filter(e => e.type === 'payable').reduce((s, e) => s + e.amount, 0);
                const isToday = day === todayStr;
                const isOverdue = day < todayStr;
                return (
                  <div key={day} className={`border rounded-2xl overflow-hidden ${isToday ? 'border-cyan-500/40' : isOverdue ? 'border-red-500/20' : 'border-white/5'}`}>
                    <div className={`px-4 py-2.5 flex items-center justify-between ${isToday ? 'bg-cyan-500/10' : isOverdue ? 'bg-red-500/5' : 'bg-gray-800/30'}`}>
                      <span className={`text-sm font-semibold ${isToday ? 'text-cyan-400' : isOverdue ? 'text-red-400' : 'text-gray-300'}`}>
                        {isToday ? '📍 Hoje — ' : isOverdue ? '🔴 ' : ''}
                        {fmtDay(day)}
                      </span>
                      <div className="flex gap-3 text-xs">
                        {dayRec > 0 && <span className="text-green-400">+{fmt(dayRec)}</span>}
                        {dayPay > 0 && <span className="text-red-400">-{fmt(dayPay)}</span>}
                      </div>
                    </div>
                    <div className="divide-y divide-white/5">
                      {dayEntries.map(e => (
                        <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                          <span>{e.type === 'receivable' ? '📥' : '📤'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-200 truncate">{e.description}</p>
                            {e.party && <p className="text-[11px] text-gray-600">{e.party}</p>}
                          </div>
                          <span className={`text-sm font-bold shrink-0 ${e.type === 'receivable' ? 'text-green-400' : 'text-red-400'}`}>
                            {fmt(e.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Summary sidebar */}
          <div className="space-y-4">
            <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-4">Resumo 60 dias</p>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">📥 Total a receber</span>
                  <span className="text-green-400 font-bold">
                    {fmt(upcoming.filter(e => e.type === 'receivable').reduce((s, e) => s + e.amount, 0))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">📤 Total a pagar</span>
                  <span className="text-red-400 font-bold">
                    {fmt(upcoming.filter(e => e.type === 'payable').reduce((s, e) => s + e.amount, 0))}
                  </span>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">⚖️ Saldo projetado</span>
                  <span className="text-cyan-400 font-bold">
                    {fmt(upcoming.filter(e => e.type === 'receivable').reduce((s, e) => s + e.amount, 0) - upcoming.filter(e => e.type === 'payable').reduce((s, e) => s + e.amount, 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Overdue alert */}
            {upcoming.filter(e => e.effective_status === 'overdue').length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                <p className="text-sm font-semibold text-red-400 mb-2">⚠️ Vencidos</p>
                {upcoming.filter(e => e.effective_status === 'overdue').map(e => (
                  <div key={e.id} className="flex justify-between text-xs text-gray-400 py-1">
                    <span className="truncate">{e.description}</span>
                    <span className="text-red-400 ml-2 shrink-0">{fmt(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
