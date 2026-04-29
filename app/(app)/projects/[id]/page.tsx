'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import type { Project, ProjectPhase, Client } from '@/lib/types/database';

type ProjectDetail = Project & {
  client: Pick<Client, 'id' | 'name'> | null;
  phases: ProjectPhase[];
};

const emptyPhase = { name: '', description: '', started_at: '', estimated_end_at: '', budget_hours: '', budget_cost: '' };

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [phaseModal, setPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null);
  const [phaseForm, setPhaseForm] = useState(emptyPhase);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/projects/${id}`);
    setProject(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function openPhase(phase?: ProjectPhase) {
    setEditingPhase(phase ?? null);
    setPhaseForm(phase ? {
      name: phase.name,
      description: phase.description ?? '',
      started_at: phase.started_at ?? '',
      estimated_end_at: phase.estimated_end_at ?? '',
      budget_hours: String(phase.budget_hours),
      budget_cost: String(phase.budget_cost),
    } : emptyPhase);
    setPhaseModal(true);
  }

  async function savePhase() {
    setSaving(true);
    const payload = {
      ...phaseForm,
      project_id: id,
      budget_hours: Number(phaseForm.budget_hours) || 0,
      budget_cost: Number(phaseForm.budget_cost) || 0,
      started_at: phaseForm.started_at || null,
      estimated_end_at: phaseForm.estimated_end_at || null,
    };
    const url = editingPhase ? `/api/projects/${id}/phases/${editingPhase.id}` : `/api/projects/${id}/phases`;
    const method = editingPhase ? 'PATCH' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    setPhaseModal(false);
    load();
  }

  if (loading) return <div className="p-8 text-gray-500 text-sm">Carregando...</div>;
  if (!project) return <div className="p-8 text-red-400 text-sm">Projeto não encontrado.</div>;

  const totalPhaseBudgetH = project.phases.reduce((s, p) => s + p.budget_hours, 0);
  const totalPhaseBudgetC = project.phases.reduce((s, p) => s + p.budget_cost, 0);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <Link href="/projects" className="text-xs text-gray-500 hover:text-gray-300 mb-3 inline-block">← Projetos</Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <Badge value={project.status} />
            </div>
            <p className="text-gray-400 text-sm">{project.client?.name ?? 'Sem cliente'}</p>
          </div>
        </div>
      </div>

      {/* Métricas do contrato */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricCard label="Receita do Contrato" value={fmt(project.contract_value)} color="text-green-400" icon="💰" />
        <MetricCard label="Budget de Horas" value={`${project.budget_hours}h`} color="text-blue-400" icon="⏱️" />
        <MetricCard label="Budget de Custo" value={fmt(project.budget_cost)} color="text-purple-400" icon="📊" />
      </div>

      {/* Fases */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Fases / Sprints</h2>
        <button onClick={() => openPhase()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">
          + Nova Fase
        </button>
      </div>

      {project.phases.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-8 text-center text-gray-600">
          <p className="text-sm">Nenhuma fase criada. Divida o projeto em fases para controle granular.</p>
          <button onClick={() => openPhase()} className="mt-3 text-blue-400 text-xs hover:underline">Criar primeira fase</button>
        </div>
      ) : (
        <div className="space-y-3">
          {project.phases.map((phase) => (
            <div key={phase.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-white">{phase.name}</h3>
                    <Badge value={phase.status} />
                  </div>
                  {phase.description && <p className="text-xs text-gray-500">{phase.description}</p>}
                </div>
                <button onClick={() => openPhase(phase)} className="text-xs text-gray-500 hover:text-blue-400 transition-colors">Editar</button>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-800">
                <Metric label="Budget Horas" value={`${phase.budget_hours}h`} />
                <Metric label="Budget Custo" value={fmt(phase.budget_cost)} />
                <div>
                  <p className="text-xs text-gray-500">Prazo</p>
                  <p className="text-sm text-gray-300">
                    {phase.estimated_end_at ? new Date(phase.estimated_end_at).toLocaleDateString('pt-BR') : '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {project.phases.length > 1 && (
            <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 flex gap-8">
              <Metric label="Total fases · Horas" value={`${totalPhaseBudgetH}h / ${project.budget_hours}h`} />
              <Metric label="Total fases · Custo" value={`${fmt(totalPhaseBudgetC)} / ${fmt(project.budget_cost)}`} />
            </div>
          )}
        </div>
      )}

      {/* Modal de fase */}
      <Modal open={phaseModal} onClose={() => setPhaseModal(false)} title={editingPhase ? 'Editar Fase' : 'Nova Fase'}>
        <div className="space-y-4">
          <Field label="Nome da Fase *" value={phaseForm.name} onChange={(v) => setPhaseForm({ ...phaseForm, name: v })} placeholder="Sprint 1 — Levantamento" />
          <Field label="Descrição" value={phaseForm.description} onChange={(v) => setPhaseForm({ ...phaseForm, description: v })} placeholder="Objetivo desta fase" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data de Início" value={phaseForm.started_at} onChange={(v) => setPhaseForm({ ...phaseForm, started_at: v })} type="date" />
            <Field label="Prazo Previsto" value={phaseForm.estimated_end_at} onChange={(v) => setPhaseForm({ ...phaseForm, estimated_end_at: v })} type="date" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Budget Horas" value={phaseForm.budget_hours} onChange={(v) => setPhaseForm({ ...phaseForm, budget_hours: v })} placeholder="80" type="number" />
            <Field label="Budget Custo (R$)" value={phaseForm.budget_cost} onChange={(v) => setPhaseForm({ ...phaseForm, budget_cost: v })} placeholder="10000" type="number" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setPhaseModal(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
            <button onClick={savePhase} disabled={saving || !phaseForm.name} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MetricCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-500 text-xs mb-2">{icon} {label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-300 font-medium">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}
