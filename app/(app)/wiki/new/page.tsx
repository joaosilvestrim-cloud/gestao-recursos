'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { markdownToHtml } from '@/lib/utils/markdown';

interface Category {
  id: string;
  name: string;
  icon: string;
}

export default function NewArticlePage() {
  return <ArticleEditor />;
}

export function ArticleEditor({ articleId, initialData }: {
  articleId?: string;
  initialData?: {
    title: string; content: string; summary: string; category_id: string;
    author_name: string; visibility: string; edit_level: string; pinned: boolean;
    change_summary?: string;
  };
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: initialData?.title ?? '',
    content: initialData?.content ?? '',
    summary: initialData?.summary ?? '',
    category_id: initialData?.category_id ?? '',
    author_name: initialData?.author_name ?? '',
    visibility: initialData?.visibility ?? 'public',
    edit_level: initialData?.edit_level ?? 'everyone',
    pinned: initialData?.pinned ?? false,
    change_summary: initialData?.change_summary ?? '',
  });
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/wiki/categories').then(r => r.json()).then(data => {
      setCategories(Array.isArray(data) ? data : []);
    });
  }, []);

  async function save() {
    if (!form.title || !form.content) {
      setError('Título e conteúdo são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');

    const body: Record<string, unknown> = {
      title: form.title,
      content: form.content,
      summary: form.summary || null,
      category_id: form.category_id || null,
      author_name: form.author_name || null,
      visibility: form.visibility,
      edit_level: form.edit_level,
      pinned: form.pinned,
    };

    if (articleId) {
      body.change_summary = form.change_summary || null;
      body.changed_by = form.author_name || 'Admin';
    }

    const res = await fetch(
      articleId ? `/api/wiki/articles/${articleId}` : '/api/wiki/articles',
      {
        method: articleId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Erro ao salvar.');
      setSaving(false);
      return;
    }

    router.push(`/wiki/${data.slug}`);
  }

  const isEditing = !!articleId;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{isEditing ? '✏️ Editar Artigo' : '✍️ Novo Artigo'}</h1>
          <p className="text-sm text-gray-400 mt-1">
            Use markdown para formatar: **negrito**, *itálico*, # Título, ``` código ```, - lista, [link](url)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/wiki" className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancelar</Link>
          <button
            onClick={() => setPreview(p => !p)}
            className={`px-3 py-2 text-sm rounded-lg transition-colors ${
              preview ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {preview ? '📝 Editar' : '👁 Preview'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-gray-900 font-semibold text-sm rounded-lg transition-colors"
          >
            {saving ? 'Salvando…' : isEditing ? 'Salvar Alterações' : 'Publicar Artigo'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">{error}</div>
      )}

      {/* Metadata row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Categoria</label>
          <select
            value={form.category_id}
            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">Sem categoria</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Visibilidade</label>
          <select
            value={form.visibility}
            onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="public">🌐 Público</option>
            <option value="internal">🏢 Interno</option>
            <option value="restricted">🔒 Restrito</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Quem pode editar</label>
          <select
            value={form.edit_level}
            onChange={e => setForm(f => ({ ...f, edit_level: e.target.value }))}
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="everyone">👥 Todos</option>
            <option value="admin_only">🔑 Só admin</option>
          </select>
        </div>
      </div>

      {/* Author + pinned */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Autor</label>
          <input
            value={form.author_name}
            onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
            placeholder="Seu nome"
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Resumo (opcional)</label>
          <input
            value={form.summary}
            onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
            placeholder="Uma linha descrevendo o artigo…"
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
              className={`w-9 h-5 rounded-full transition-colors ${form.pinned ? 'bg-cyan-500' : 'bg-gray-700'} relative`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${form.pinned ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-gray-400">{form.pinned ? '📌 Fixado no topo' : 'Fixar no topo'}</span>
          </label>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Título <span className="text-red-400">*</span></label>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Título do artigo…"
          className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-xl font-bold text-white placeholder-gray-700 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Change summary (edit only) */}
      {isEditing && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Resumo da alteração</label>
          <input
            value={form.change_summary}
            onChange={e => setForm(f => ({ ...f, change_summary: e.target.value }))}
            placeholder="Ex: Adicionei seção de troubleshooting"
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
          />
          <p className="text-[11px] text-gray-600 mt-1">Aparece no histórico de versões. Ajuda a entender o que mudou.</p>
        </div>
      )}

      {/* Content editor / preview */}
      {preview ? (
        <div className="bg-gray-900 border border-white/5 rounded-xl p-6 min-h-96">
          <p className="text-[11px] text-gray-600 uppercase tracking-wider mb-4">Preview</p>
          {form.content ? (
            <div dangerouslySetInnerHTML={{ __html: markdownToHtml(form.content) }} />
          ) : (
            <p className="text-gray-600 italic">Nenhum conteúdo para mostrar.</p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Conteúdo <span className="text-red-400">*</span>
            <span className="ml-2 text-gray-600">· Markdown suportado</span>
          </label>
          <textarea
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder={`# Título principal\n\nEscreva o conteúdo do artigo aqui.\n\n## Seção\n\nUse **negrito**, *itálico*, \`código\`.\n\n- Lista item 1\n- Lista item 2\n\n> Citação ou nota importante`}
            rows={24}
            className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-cyan-500 font-mono resize-y"
          />
          <p className="text-[11px] text-gray-600 mt-1">
            Suporte: # H1, ## H2, **negrito**, *itálico*, `código`, ```bloco```, - lista, 1. numerada, [link](url), &gt; citação, ---
          </p>
        </div>
      )}
    </div>
  );
}
