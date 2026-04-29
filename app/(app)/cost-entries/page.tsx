'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';

interface Project { id: string; name: string; }
interface Collaborator {
  id: string;
  name: string;
  role: string;
  current_cost: { hourly_cost: number; valid_until: string | null }[];
}
interface CostEntry {
  id: string; entry_date: string; collaborator_name: string;
  hours: number; hourly_cost: number; amount_override: number;
  entry_type: string; source: string; description: string;
  project: { name: string };
}

interface CsvRow {
  collaborator: string;
  date: string;
  hours: string;
  type: string;
  matched: boolean;
  hourly_cost: number | null;
  cost: number | null;
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0);
}

function normalize(s: string) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function currentHourlyCost(c: Collaborator): number | null {
  return c.current_cost?.find(h => !h.valid_until)?.hourly_cost ?? null;
}

const emptyForm = {
  project_id: '', collaborator_id: '', collaborator_name: '',
  entry_date: new Date().toISOString().split('T')[0],
  hours: '', hourly_cost: '', entry_type: 'billable', description: '',
};

export default function CostEntriesPage() {
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // CSV state
  const [dragging, setDragging] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([]);
  const [importProjectId, setImportProjectId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; errors: string[]; warnings: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const [eRes, pRes, cRes] = await Promise.all([
      fetch('/api/cost-entries?limit=50'),
      fetch('/api/projects'),
      fetch('/api/collaborators'),
    ]);
    setEntries(await eRes.json());
    setProjects(await pRes.json());
    setCollaborators(await cRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Build cost lookup map for CSV preview
  const costMap = useCallback(() => {
    const map = new Map<string, { hourly_cost: number | null }>();
    collaborators.forEach(c => {
      map.set(normalize(c.name), { hourly_cost: currentHourlyCost(c) });
    });
    return map;
  }, [collaborators]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
  }, [collaborators]); // eslint-disable-line

  function handleFile(file: File) {
    setCsvFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;

      const header = lines[0].toLowerCase();
      const isClockify = header.includes('user') && header.includes('duration');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const get = (cols: string[], key: string) => cols[headers.findIndex(h => h.includes(key))] ?? '';

      const map = costMap();
      const rows: CsvRow[] = lines.slice(1, 11).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        let collaborator: string, date: string, hours: string, type: string;

        if (isClockify) {
          collaborator = get(cols, 'user');
          date = get(cols, 'start date') || get(cols, 'date');
          hours = get(cols, 'duration (decimal)') || get(cols, 'hours');
          type = get(cols, 'billable') === 'yes' || get(cols, 'billable') === 'true' ? 'billable' : 'non_billable';
        } else {
          [date, collaborator, hours, , type] = cols;
        }

        const match = map.get(normalize(collaborator ?? ''));
        const h = parseFloat(hours);
        const hc = match?.hourly_cost ?? null;
        return {
          collaborator: collaborator ?? '',
          date: date ?? '',
          hours: hours ?? '',
          type: type ?? 'billable',
          matched: !!match,
          hourly_cost: hc,
          cost: match && hc !== null && !isNaN(h) ? h * hc : null,
        };
      });

      setCsvPreview(rows);
    };
    reader.readAsText(file);
  }

  async function processImport() {
    if (!csvFile || !importProjectId) return;
    setImporting(true);
    const fd = new FormData();
    fd.append('file', csvFile);
    fd.append('project_id', importProjectId);
    const res = await fetch('/api/cost-entries/import', { method: 'POST', body: fd });
    const result = await res.json();
    setImportResult(result);
    setImporting(false);
    if (result.ok > 0) { setCsvFile(null); setCsvPreview([]); load(); }
  }

  // When collaborator is selected in manual form, auto-fill hourly cost
  function selectCollaborator(id: string) {
    const c = collaborators.find(x => x.id === id);
    const hc = c ? currentHourlyCost(c) : null;
    setForm(f => ({
      ...f,
      collaborator_id: id,
      collaborator_name: c?.name ?? '',
      hourly_cost: hc !== null ? String(hc) : '',
    }));
  }

  async function saveManual() {
    setSaving(true);
    const payload = {
      project_id: form.project_id,
      collaborator_id: form.collaborator_id || null,
      collaborator_name: form.collaborator_name || null,
      entry_date: form.entry_date,
      hours: form.hours ? Number(form.hours) : null,
      hourly_cost: form.hourly_cost ? Number(form.hourly_cost) : null,
      entry_type: form.entry_type,
      description: form.description || null,
      source: 'manual',
    };
    const res = await fetch('/api/cost-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(`Erro: ${err.error}`);
    }
    setSaving(false); setManualOpen(false); load();
  }

  const selectedCollab = collaborators.find(c => c.id === form.collaborator_id);
  const manualCost = form.hours && form.hourly_cost
    ? Number(form.hours) * Number(form.hourly_cost)
    : null;

  const totalCost = entries.reduce((s, e) => s + (e.amount_override ?? (e.hours ?? 0) * (e.hourly_cost ?? 0)), 0);
  const totalHours = entries.reduce((s, e) => s + (e.hours ?? 0), 0);
  const unmatchedPct = csvPreview.length > 0
    ? Math.round((csvPreview.filter(r => !r.matched).length / csvPreview.length) * 100)
    : 0;

  return (
    <div className="p-8">
      <PageHeader
        title="Lançar / Importar"
        description="Traga as horas do Clockify ou outro sistema — o custo é calculado automaticamente"
        action={
          <button onClick={() => { setForm(emptyForm); setManualOpen(true); }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity">
            + Lançar Manual
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

        {/* Main: Drag & Drop + Preview */}
        <div className="xl:col-span-2 space-y-4">

          {/* Drag & Drop */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              dragging ? 'border-cyan-400 bg-cyan-400/10' : csvFile ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'
            }`}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {csvFile ? (
              <>
                <p className="text-3xl mb-2">✅</p>
                <p className="text-green-400 font-semibold">{csvFile.name}</p>
                <p className="text-gray-500 text-sm mt-1">{csvPreview.length} linhas · Clique para trocar</p>
              </>
            ) : (
              <>
                <p className="text-4xl mb-3">📂</p>
                <p className="text-white font-semibold">Arraste o CSV do Clockify aqui</p>
                <p className="text-gray-500 text-sm mt-1">ou clique para selecionar · O custo H/H é buscado automaticamente</p>
                <a href="/csv-template.csv" download onClick={(e) => e.stopPropagation()}
                  className="inline-block mt-4 text-xs text-cyan-400 hover:underline border border-cyan-500/30 px-3 py-1.5 rounded-lg">
                  ↓ Baixar modelo CSV
                </a>
              </>
            )}
          </div>

          {/* Preview table */}
          {csvPreview.length > 0 && (
            <div className="bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <div>
                  <p className="text-sm font-semibold text-white">Pré-visualização</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {csvPreview.filter(r => r.matched).length} colaboradores reconhecidos
                    {unmatchedPct > 0 && <span className="text-yellow-400 ml-2">· {unmatchedPct}% sem match — verifique os nomes</span>}
                  </p>
                </div>
                <p className="text-xs text-gray-600">Primeiras {csvPreview.length} linhas</p>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-600 uppercase tracking-wide">
                    <th className="text-left px-5 py-2">Colaborador</th>
                    <th className="text-left px-4 py-2">Data</th>
                    <th className="text-right px-4 py-2">Horas</th>
                    <th className="text-right px-4 py-2">H/H</th>
                    <th className="text-right px-4 py-2 text-cyan-500">Custo Calc.</th>
                    <th className="text-center px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.map((r, i) => (
                    <tr key={i} className={`border-b border-white/5 ${!r.matched ? 'bg-yellow-500/5' : ''}`}>
                      <td className="px-5 py-2.5">
                        <p className={`font-medium ${r.matched ? 'text-white' : 'text-yellow-400'}`}>{r.collaborator || '—'}</p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 tabular-nums">{r.date}</td>
                      <td className="px-4 py-2.5 text-right text-cyan-400 tabular-nums">{r.hours}h</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">
                        {r.hourly_cost !== null ? fmt(r.hourly_cost) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                        {r.cost !== null
                          ? <span className="text-red-400">{fmt(r.cost)}</span>
                          : <span className="text-gray-600">sem custo</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {r.matched
                          ? <span className="text-green-400 text-[10px] bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">✓ OK</span>
                          : <span className="text-yellow-400 text-[10px] bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded">Não cadastrado</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                {csvPreview.some(r => r.cost !== null) && (
                  <tfoot>
                    <tr className="border-t border-white/10 bg-gray-900/40">
                      <td colSpan={4} className="px-5 py-3 text-xs text-gray-500 uppercase tracking-wide">Custo estimado (pré-vis.)</td>
                      <td className="px-4 py-3 text-right font-bold text-red-400 text-sm tabular-nums">
                        {fmt(csvPreview.reduce((s, r) => s + (r.cost ?? 0), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>

              {/* Project select + process */}
              <div className="flex items-center gap-3 px-5 py-4 border-t border-white/5 bg-gray-900/40">
                <select value={importProjectId} onChange={(e) => setImportProjectId(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                  <option value="">Selecione o projeto destino *</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={processImport} disabled={!importProjectId || importing}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-opacity whitespace-nowrap">
                  {importing ? 'Processando...' : '⚡ Processar Custos'}
                </button>
              </div>

              {importResult && (
                <div className={`px-5 py-3 border-t border-white/5 space-y-1 ${importResult.ok > 0 ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                  {importResult.ok > 0 && (
                    <p className="text-green-400 text-sm">✓ {importResult.ok} registros importados com custo calculado</p>
                  )}
                  {importResult.warnings?.map((w, i) => (
                    <p key={i} className="text-yellow-400 text-xs">⚠ {w}</p>
                  ))}
                  {importResult.errors?.map((e, i) => (
                    <p key={i} className="text-red-400 text-xs">✗ {e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* How it works */}
          <div className="bg-gray-900/70 border border-white/5 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Como funciona</h3>
            <ol className="space-y-3 text-xs text-gray-400">
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold">1</span>
                <span>Exporte o CSV do Clockify (ou similar) com as horas da semana</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold">2</span>
                <span>Arraste o arquivo — o sistema cruza cada nome com o custo H/H cadastrado</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 font-bold">3</span>
                <span>Selecione o projeto e clique em Processar — o balde do projeto é descontado</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0 font-bold">!</span>
                <span>Colaboradores sem custo cadastrado são importados com custo zero — cadastre em <strong className="text-white">Colaboradores</strong> primeiro</span>
              </li>
            </ol>
          </div>

          {/* Stats */}
          <div className="bg-gray-900/70 border border-white/5 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Últimos 50 lançamentos</h3>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Registros</span>
              <span className="text-sm font-bold text-white">{entries.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Horas totais</span>
              <span className="text-sm font-bold text-cyan-400">{totalHours.toFixed(0)}h</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Custo apurado</span>
              <span className="text-sm font-bold text-red-400">{fmt(totalCost)}</span>
            </div>
            {entries.length > 0 && (
              <div className="pt-2 border-t border-white/5">
                <p className="text-xs text-gray-600 mb-1">Custo médio/hora</p>
                <p className="text-lg font-bold text-white">
                  {fmt(totalHours > 0 ? totalCost / totalHours : 0)}/h
                </p>
              </div>
            )}
          </div>

          {/* Collaborators without cost */}
          {collaborators.filter(c => currentHourlyCost(c) === null).length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">⚠ Sem custo H/H</h3>
              <p className="text-xs text-gray-500 mb-2">Esses colaboradores não têm custo cadastrado:</p>
              <ul className="space-y-1">
                {collaborators.filter(c => currentHourlyCost(c) === null).map(c => (
                  <li key={c.id} className="text-xs text-red-300">{c.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Entries table */}
      {!loading && entries.length > 0 && (
        <div className="bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Lançamentos Recentes</h2>
            <span className="text-xs text-gray-600">{entries.length} registros</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-600 text-xs uppercase">
                <th className="text-left px-6 py-3">Data</th>
                <th className="text-left px-4 py-3">Colaborador</th>
                <th className="text-left px-4 py-3">Projeto</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Horas</th>
                <th className="text-right px-4 py-3">H/H</th>
                <th className="text-right px-4 py-3 text-red-400">Custo</th>
                <th className="text-left px-4 py-3">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const cost = e.amount_override ?? (e.hours ?? 0) * (e.hourly_cost ?? 0);
                return (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3 text-gray-300 tabular-nums text-xs">
                      {new Date(e.entry_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-white font-medium text-xs">{e.collaborator_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{e.project?.name ?? '—'}</td>
                    <td className="px-4 py-3"><Badge value={e.entry_type} /></td>
                    <td className="px-4 py-3 text-right text-gray-400 tabular-nums text-xs">
                      {e.hours ? `${e.hours}h` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums text-xs">
                      {e.hourly_cost ? fmt(e.hourly_cost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-xs">
                      <span className={cost > 0 ? 'text-red-400' : 'text-gray-600'}>{fmt(cost)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded ${
                        e.source === 'csv' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'
                      }`}>
                        {e.source === 'csv' ? 'CSV' : 'Manual'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual entry modal */}
      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Novo Lançamento Manual">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Projeto *</label>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="">Selecione...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Tipo *</label>
              <select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="billable">Faturável</option>
                <option value="non_billable">Não Faturável</option>
                <option value="absence">Ausência</option>
                <option value="idle">Ociosidade</option>
              </select>
            </div>
          </div>

          {/* Collaborator select — auto-fills cost */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Colaborador</label>
            <select value={form.collaborator_id} onChange={(e) => selectCollaborator(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
              <option value="">Selecione o colaborador...</option>
              {collaborators.map(c => {
                const hc = currentHourlyCost(c);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} {hc !== null ? `— ${fmt(hc)}/h` : '(sem custo)'}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Data *</label>
              <input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Horas *</label>
              <input type="number" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })}
                placeholder="8" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
          </div>

          {/* Cost preview */}
          <div className={`rounded-xl p-4 border ${form.collaborator_id && form.hourly_cost ? 'bg-cyan-500/5 border-cyan-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Custo H/H</p>
                <p className="text-sm font-bold text-white">
                  {form.hourly_cost ? fmt(Number(form.hourly_cost)) : <span className="text-gray-600">—</span>}
                  <span className="text-gray-500 font-normal">/hora</span>
                </p>
                {selectedCollab && !form.hourly_cost && (
                  <p className="text-xs text-red-400 mt-1">Este colaborador não tem custo cadastrado</p>
                )}
              </div>
              {manualCost !== null && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Custo total</p>
                  <p className="text-xl font-bold text-red-400">{fmt(manualCost)}</p>
                  <p className="text-[10px] text-gray-600">{form.hours}h × {fmt(Number(form.hourly_cost))}</p>
                </div>
              )}
            </div>
            {!form.collaborator_id && (
              <p className="text-xs text-gray-600 mt-2">Selecione um colaborador para preencher o custo automaticamente</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descrição</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Atividade realizada"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setManualOpen(false)}
              className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">
              Cancelar
            </button>
            <button onClick={saveManual} disabled={saving || !form.project_id || !form.entry_date || !form.hours}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium transition-opacity">
              {saving ? 'Salvando...' : `Salvar${manualCost !== null ? ` — ${fmt(manualCost)}` : ''}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
