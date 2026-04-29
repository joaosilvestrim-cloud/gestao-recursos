'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';

interface Project { id: string; name: string; }
interface CostEntry {
  id: string; entry_date: string; collaborator_name: string;
  hours: number; hourly_cost: number; amount_override: number;
  entry_type: string; source: string; description: string;
  project: { name: string };
}
interface CsvRow { date: string; resource: string; project: string; hours: string; billable: string; }

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
}

const WEBHOOK_KEY = 'dd_live_k9x2mQpL8nRvTaZ3wYbN';
const WEBHOOK_URL = 'https://gestao-recursos.vercel.app/api/cost-entries/import';

const emptyForm = {
  project_id: '', collaborator_name: '',
  entry_date: new Date().toISOString().split('T')[0],
  hours: '', hourly_cost: '', amount_override: '',
  entry_type: 'billable', description: '',
};

export default function CostEntriesPage() {
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // CSV import state
  const [dragging, setDragging] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([]);
  const [importProjectId, setImportProjectId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; errors: string[] } | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const [eRes, pRes] = await Promise.all([fetch('/api/cost-entries?limit=50'), fetch('/api/projects')]);
    setEntries(await eRes.json());
    setProjects(await pRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  /* Drag & Drop */
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
  }, []);

  function handleFile(file: File) {
    setCsvFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim()).slice(1, 6);
      const rows: CsvRow[] = lines.map(l => {
        const [date, resource, project, hours, billable] = l.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        return { date: date ?? '', resource: resource ?? '', project: project ?? '', hours: hours ?? '', billable: billable ?? '' };
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

  async function saveManual() {
    setSaving(true);
    const payload = {
      ...form,
      hours: form.hours ? Number(form.hours) : null,
      hourly_cost: form.hourly_cost ? Number(form.hourly_cost) : null,
      amount_override: form.amount_override ? Number(form.amount_override) : null,
      collaborator_name: form.collaborator_name || null,
    };
    await fetch('/api/cost-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false); setManualOpen(false); load();
  }

  const totalCost = entries.reduce((s, e) => s + (e.amount_override ?? (e.hours ?? 0) * (e.hourly_cost ?? 0)), 0);

  return (
    <div className="p-8">
      <PageHeader
        title="Importação de Dados Operacionais"
        description="Traga o consolidado de horas de sistemas externos via CSV ou lançamento manual"
        action={
          <button onClick={() => { setForm(emptyForm); setManualOpen(true); }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity">
            + Lançar Manual
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

        {/* Área principal: Drag & Drop + Preview */}
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
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {csvFile ? (
              <>
                <p className="text-3xl mb-2">✅</p>
                <p className="text-green-400 font-semibold">{csvFile.name}</p>
                <p className="text-gray-500 text-sm mt-1">{csvPreview.length} linhas pré-visualizadas · Clique para trocar</p>
              </>
            ) : (
              <>
                <p className="text-4xl mb-3">📂</p>
                <p className="text-white font-semibold">Arraste o CSV aqui</p>
                <p className="text-gray-500 text-sm mt-1">ou clique para selecionar o arquivo</p>
                <a href="/csv-template.csv" download onClick={(e) => e.stopPropagation()}
                  className="inline-block mt-4 text-xs text-cyan-400 hover:underline border border-cyan-500/30 px-3 py-1.5 rounded-lg">
                  ↓ Baixar modelo CSV
                </a>
              </>
            )}
          </div>

          {/* Pré-visualização */}
          {csvPreview.length > 0 && (
            <div className="bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <p className="text-sm font-semibold text-white">Pré-visualização da Importação</p>
                <p className="text-xs text-gray-500">Primeiras {csvPreview.length} linhas</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-600 uppercase">
                    <th className="text-left px-5 py-2">Data</th>
                    <th className="text-left px-4 py-2">Recurso</th>
                    <th className="text-left px-4 py-2">Projeto</th>
                    <th className="text-right px-4 py-2">Horas</th>
                    <th className="text-left px-4 py-2">Faturável</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.map((r, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-5 py-2.5 text-gray-300 tabular-nums">{r.date}</td>
                      <td className="px-4 py-2.5 text-white font-medium">{r.resource}</td>
                      <td className="px-4 py-2.5 text-gray-400">{r.project}</td>
                      <td className="px-4 py-2.5 text-right text-cyan-400 tabular-nums">{r.hours}h</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${r.billable === 'billable' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                          {r.billable === 'billable' ? 'Faturável' : r.billable || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Botão processar */}
              <div className="flex items-center gap-3 px-5 py-4 border-t border-white/5 bg-gray-900/40">
                <select value={importProjectId} onChange={(e) => setImportProjectId(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                  <option value="">Selecione o projeto *</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={processImport} disabled={!importProjectId || importing}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-opacity whitespace-nowrap">
                  {importing ? 'Processando...' : '⚡ Processar Custos'}
                </button>
              </div>

              {importResult && (
                <div className={`px-5 py-3 text-sm ${importResult.ok > 0 ? 'text-green-400 bg-green-500/5' : 'text-red-400 bg-red-500/5'}`}>
                  {importResult.ok > 0 && <p>✓ {importResult.ok} registros importados com sucesso</p>}
                  {importResult.errors.length > 0 && <p>✗ {importResult.errors.slice(0, 2).join(' · ')}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Painel lateral: Integração API */}
        <div className="space-y-4">
          <div className="bg-gray-900/70 border border-white/5 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-1">🔌 Integração via API</h3>
            <p className="text-xs text-gray-500 mb-4">Conecte seu sistema externo para importação automatizada</p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Endpoint</p>
                <div className="bg-gray-800 rounded-lg px-3 py-2 font-mono text-[10px] text-cyan-400 break-all">{WEBHOOK_URL}</div>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Chave de API</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-800 rounded-lg px-3 py-2 font-mono text-[10px] text-green-400 truncate">{WEBHOOK_KEY}</div>
                  <button onClick={() => { navigator.clipboard.writeText(WEBHOOK_KEY); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000); }}
                    className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors">
                    {keyCopied ? '✓' : '📋'}
                  </button>
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-3 font-mono text-[10px] text-gray-400 leading-relaxed">
                <p className="text-cyan-400 mb-1">POST {WEBHOOK_URL.split('/').slice(-3).join('/')}</p>
                <p>Authorization: Bearer {WEBHOOK_KEY.slice(0, 12)}...</p>
                <p>Content-Type: multipart/form-data</p>
                <p className="mt-1 text-gray-600">{'{'}</p>
                <p className="pl-2">project_id: &quot;uuid&quot;,</p>
                <p className="pl-2">file: arquivo.csv</p>
                <p className="text-gray-600">{'}'}</p>
              </div>
              <p className="text-[10px] text-gray-600">Compatível com Toggl, Clockify, Harvest e qualquer sistema que exporte CSV.</p>
            </div>
          </div>

          {/* Resumo */}
          <div className="bg-gray-900/70 border border-white/5 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumo (últimos 50)</h3>
            <div className="flex justify-between"><span className="text-xs text-gray-500">Registros</span><span className="text-sm font-bold text-white">{entries.length}</span></div>
            <div className="flex justify-between"><span className="text-xs text-gray-500">Custo total</span><span className="text-sm font-bold text-red-400">{fmt(totalCost)}</span></div>
            <div className="flex justify-between"><span className="text-xs text-gray-500">Horas</span><span className="text-sm font-bold text-cyan-400">{entries.reduce((s, e) => s + (e.hours ?? 0), 0).toFixed(0)}h</span></div>
          </div>
        </div>
      </div>

      {/* Tabela de lançamentos */}
      {!loading && entries.length > 0 && (
        <div className="bg-gray-900/70 border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Lançamentos Recentes</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-600 text-xs uppercase">
                <th className="text-left px-6 py-3">Data</th>
                <th className="text-left px-4 py-3">Recurso</th>
                <th className="text-left px-4 py-3">Projeto</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Horas</th>
                <th className="text-right px-4 py-3">Custo</th>
                <th className="text-left px-4 py-3">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const cost = e.amount_override ?? (e.hours ?? 0) * (e.hourly_cost ?? 0);
                return (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3 text-gray-300 tabular-nums text-xs">{new Date(e.entry_date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-white font-medium">{e.collaborator_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{e.project?.name ?? '—'}</td>
                    <td className="px-4 py-3"><Badge value={e.entry_type} /></td>
                    <td className="px-4 py-3 text-right text-gray-400 tabular-nums text-xs">{e.hours ? `${e.hours}h` : '—'}</td>
                    <td className="px-4 py-3 text-right text-red-400 tabular-nums font-semibold text-xs">{fmt(cost)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded ${e.source === 'csv' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
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

      {/* Modal lançamento manual */}
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Recurso / Colaborador" value={form.collaborator_name} onChange={(v) => setForm({ ...form, collaborator_name: v })} placeholder="Nome do recurso" />
            <Field label="Data *" value={form.entry_date} onChange={(v) => setForm({ ...form, entry_date: v })} type="date" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Horas" value={form.hours} onChange={(v) => setForm({ ...form, hours: v })} placeholder="8" type="number" />
            <Field label="Custo H/H (R$)" value={form.hourly_cost} onChange={(v) => setForm({ ...form, hourly_cost: v })} placeholder="150" type="number" />
            <Field label="Ou valor fixo (R$)" value={form.amount_override} onChange={(v) => setForm({ ...form, amount_override: v })} placeholder="Total direto" type="number" />
          </div>
          <Field label="Descrição" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Atividade realizada" />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setManualOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
            <button onClick={saveManual} disabled={saving || !form.project_id || !form.entry_date}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium transition-opacity">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors" />
    </div>
  );
}
