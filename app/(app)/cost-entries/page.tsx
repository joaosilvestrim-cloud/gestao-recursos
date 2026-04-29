'use client';

import { useEffect, useState, useRef } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';

interface Project { id: string; name: string; }
interface Phase { id: string; name: string; }
interface Collaborator { id: string; name: string; }
interface CostEntry {
  id: string;
  entry_date: string;
  collaborator_name: string;
  hours: number;
  hourly_cost: number;
  amount_override: number;
  entry_type: string;
  source: string;
  description: string;
  project: { name: string };
}

const entryTypes = [
  { value: 'billable', label: 'Faturável' },
  { value: 'non_billable', label: 'Não Faturável' },
  { value: 'absence', label: 'Ausência' },
  { value: 'idle', label: 'Ociosidade' },
];

const emptyForm = {
  project_id: '', phase_id: '', collaborator_id: '', collaborator_name: '',
  entry_date: new Date().toISOString().split('T')[0],
  hours: '', hourly_cost: '', amount_override: '',
  entry_type: 'billable', description: '',
};

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
}

export default function CostEntriesPage() {
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; errors: string[] } | null>(null);
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

  async function loadPhases(projectId: string) {
    if (!projectId) { setPhases([]); return; }
    const res = await fetch(`/api/projects/${projectId}`);
    const data = await res.json();
    setPhases(data.phases ?? []);
  }

  async function save() {
    setSaving(true);
    const payload = {
      ...form,
      hours: form.hours ? Number(form.hours) : null,
      hourly_cost: form.hourly_cost ? Number(form.hourly_cost) : null,
      amount_override: form.amount_override ? Number(form.amount_override) : null,
      phase_id: form.phase_id || null,
      collaborator_id: form.collaborator_id || null,
      collaborator_name: form.collaborator_name || null,
    };
    await fetch('/api/cost-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function importCsv() {
    if (!csvFile || !form.project_id) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append('file', csvFile);
    fd.append('project_id', form.project_id);
    const res = await fetch('/api/cost-entries/import', { method: 'POST', body: fd });
    const result = await res.json();
    setImportResult(result);
    setImporting(false);
    load();
  }

  const totalCost = entries.reduce((s, e) => {
    const c = e.amount_override ?? (e.hours ?? 0) * (e.hourly_cost ?? 0);
    return s + c;
  }, 0);

  return (
    <div className="p-8">
      <PageHeader
        title="Lançar / Importar Custos"
        description="Entrada de dados financeiros — manual ou via CSV"
        action={
          <button onClick={() => { setForm(emptyForm); setModalOpen(true); }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-green-600 hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity">
            + Lançar Manual
          </button>
        }
      />

      {/* Import CSV */}
      <div className="bg-gray-900/60 border border-white/5 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">📥 Importar via CSV</h2>
        <p className="text-xs text-gray-500 mb-4">
          O arquivo CSV deve ter as colunas: <code className="bg-gray-800 px-1 rounded text-cyan-400">data, colaborador, horas, custo_hora, tipo, descricao</code>
        </p>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Projeto *</label>
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Selecione...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Arquivo CSV *</label>
            <input ref={fileRef} type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="block text-sm text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600" />
          </div>
          <button
            onClick={importCsv}
            disabled={!csvFile || !form.project_id || importing}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {importing ? 'Importando...' : 'Importar'}
          </button>
          <a href="/csv-template.csv" download className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white text-xs rounded-lg transition-colors">
            Baixar modelo CSV
          </a>
        </div>
        {importResult && (
          <div className="mt-4 p-3 rounded-lg bg-gray-800 text-sm">
            <p className="text-green-400">✓ {importResult.ok} linhas importadas</p>
            {importResult.errors.length > 0 && (
              <p className="text-red-400 mt-1">✗ {importResult.errors.length} erros: {importResult.errors.slice(0, 3).join(', ')}</p>
            )}
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900/60 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Lançamentos (últimos 50)</p>
          <p className="text-xl font-bold text-white">{entries.length}</p>
        </div>
        <div className="bg-gray-900/60 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Custo total visível</p>
          <p className="text-xl font-bold text-red-400">{fmt(totalCost)}</p>
        </div>
        <div className="bg-gray-900/60 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Horas totais</p>
          <p className="text-xl font-bold text-cyan-400">
            {entries.reduce((s, e) => s + (e.hours ?? 0), 0).toFixed(1)}h
          </p>
        </div>
      </div>

      {/* Listagem */}
      {loading ? <p className="text-gray-500 text-sm">Carregando...</p> : (
        <div className="bg-gray-900/60 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-600 text-xs uppercase">
                <th className="text-left px-5 py-3">Data</th>
                <th className="text-left px-4 py-3">Colaborador</th>
                <th className="text-left px-4 py-3">Projeto</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Horas</th>
                <th className="text-right px-4 py-3">Custo</th>
                <th className="text-left px-4 py-3">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-600 text-sm">Nenhum lançamento ainda.</td></tr>
              ) : entries.map((e) => {
                const cost = e.amount_override ?? (e.hours ?? 0) * (e.hourly_cost ?? 0);
                return (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3 text-gray-300 tabular-nums">{new Date(e.entry_date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-white">{e.collaborator_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{e.project?.name ?? '—'}</td>
                    <td className="px-4 py-3"><Badge value={e.entry_type} /></td>
                    <td className="px-4 py-3 text-right text-gray-400 tabular-nums">{e.hours ? `${e.hours}h` : '—'}</td>
                    <td className="px-4 py-3 text-right text-red-400 tabular-nums font-medium">{fmt(cost)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${e.source === 'csv' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Lançamento">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Projeto *</label>
              <select value={form.project_id}
                onChange={(e) => { setForm({ ...form, project_id: e.target.value, phase_id: '' }); loadPhases(e.target.value); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="">Selecione...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Fase</label>
              <select value={form.phase_id} onChange={(e) => setForm({ ...form, phase_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="">Sem fase</option>
                {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Colaborador</label>
              <select value={form.collaborator_id}
                onChange={(e) => {
                  const c = collaborators.find(c => c.id === e.target.value);
                  setForm({ ...form, collaborator_id: e.target.value, collaborator_name: c?.name ?? '' });
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="">Selecione ou digite abaixo</option>
                {collaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Field label="Nome livre (se não cadastrado)" value={form.collaborator_name}
              onChange={(v) => setForm({ ...form, collaborator_name: v })} placeholder="Nome do recurso" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data *" value={form.entry_date} onChange={(v) => setForm({ ...form, entry_date: v })} type="date" />
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Tipo *</label>
              <select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                {entryTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Horas" value={form.hours} onChange={(v) => setForm({ ...form, hours: v })} placeholder="8" type="number" />
            <Field label="Custo H/H (R$)" value={form.hourly_cost} onChange={(v) => setForm({ ...form, hourly_cost: v })} placeholder="150" type="number" />
            <Field label="Valor fixo (R$)" value={form.amount_override} onChange={(v) => setForm({ ...form, amount_override: v })} placeholder="Ou informe total" type="number" />
          </div>
          <Field label="Descrição" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Ex: Desenvolvimento módulo WMS" />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving || !form.project_id || !form.entry_date}
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
