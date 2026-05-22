'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { plainTextPreview } from '@/lib/utils/markdown';

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  slug: string;
  order_index: number;
  article_count: { count: number }[];
}

interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  category_id: string | null;
  author_name: string | null;
  pinned: boolean;
  views: number;
  updated_at: string;
  visibility: string;
  edit_level: string;
  category: { id: string; name: string; icon: string; slug: string } | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  if (days < 365) return `há ${Math.floor(days / 30)} meses`;
  return `há ${Math.floor(days / 365)} ano(s)`;
}

export default function WikiPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: '📄', description: '' });
  const [savingCat, setSavingCat] = useState(false);

  async function load() {
    const [cats, arts] = await Promise.all([
      fetch('/api/wiki/categories').then(r => r.json()),
      fetch('/api/wiki/articles').then(r => r.json()),
    ]);
    setCategories(Array.isArray(cats) ? cats : []);
    setArticles(Array.isArray(arts) ? arts : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = articles;
    if (activeCategory) list = list.filter(a => a.category_id === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.summary ?? '').toLowerCase().includes(q) ||
        plainTextPreview(a.content).toLowerCase().includes(q)
      );
    }
    return list;
  }, [articles, activeCategory, search]);

  const pinned = filtered.filter(a => a.pinned);
  const regular = filtered.filter(a => !a.pinned);

  async function saveCategory() {
    if (!newCat.name) return;
    setSavingCat(true);
    await fetch('/api/wiki/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCat) });
    setSavingCat(false);
    setShowNewCat(false);
    setNewCat({ name: '', icon: '📄', description: '' });
    load();
  }

  const ICONS = ['📄', '🚀', '⚙️', '💰', '💻', '👥', '📁', '🎯', '📊', '🔧', '📋', '🌐', '🔐', '📚', '💡'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Carregando wiki…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-white/5 p-4 space-y-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Categorias</p>
          <button
            onClick={() => setShowNewCat(true)}
            className="w-5 h-5 rounded text-gray-500 hover:text-white hover:bg-white/10 text-sm flex items-center justify-center transition-colors"
            title="Nova categoria"
          >+</button>
        </div>

        <button
          onClick={() => setActiveCategory('')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
            activeCategory === '' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📚</span>
          <span className="flex-1 text-left">Todos</span>
          <span className="text-[11px] text-gray-600">{articles.length}</span>
        </button>

        {categories.map(cat => {
          const count = articles.filter(a => a.category_id === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                activeCategory === cat.id ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{cat.icon}</span>
              <span className="flex-1 text-left truncate">{cat.name}</span>
              <span className="text-[11px] text-gray-600">{count}</span>
            </button>
          );
        })}
      </aside>

      {/* Main */}
      <div className="flex-1 p-6 space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">📚 Wiki / Intranet</h1>
            <p className="text-sm text-gray-400 mt-1">
              Base de conhecimento da equipe. Processos, onboarding, políticas e documentação técnica — tudo em um lugar.
            </p>
          </div>
          <Link
            href="/wiki/new"
            className="shrink-0 bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + Novo Artigo
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar artigos por título, resumo ou conteúdo…"
            className="w-full bg-gray-900 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-lg leading-none">×</button>
          )}
        </div>

        {/* Active category header */}
        {activeCategory && (
          <div className="flex items-center gap-2">
            {(() => {
              const cat = categories.find(c => c.id === activeCategory);
              return cat ? (
                <>
                  <span className="text-lg">{cat.icon}</span>
                  <div>
                    <p className="text-white font-semibold">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-500">{cat.description}</p>}
                  </div>
                </>
              ) : null;
            })()}
          </div>
        )}

        {/* Pinned articles */}
        {pinned.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">📌 Fixados</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pinned.map(a => <ArticleCard key={a.id} article={a} />)}
            </div>
          </div>
        )}

        {/* All articles */}
        {regular.length === 0 && pinned.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg font-medium text-gray-500">Nenhum artigo encontrado</p>
            <p className="text-sm mt-1">
              {search ? 'Tente outros termos de busca.' : 'Clique em "+ Novo Artigo" para criar o primeiro.'}
            </p>
          </div>
        ) : regular.length > 0 ? (
          <div>
            {pinned.length > 0 && <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">Todos os Artigos</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {regular.map(a => <ArticleCard key={a.id} article={a} />)}
            </div>
          </div>
        ) : null}

        {/* Category grid — only on "all" view with no search */}
        {!activeCategory && !search && articles.length === 0 && categories.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="bg-gray-900 border border-white/5 hover:border-cyan-500/30 rounded-xl p-5 text-left transition-all group"
              >
                <p className="text-2xl mb-2">{cat.icon}</p>
                <p className="text-white font-semibold group-hover:text-cyan-400 transition-colors">{cat.name}</p>
                {cat.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{cat.description}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New category modal */}
      {showNewCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Nova Categoria</h2>
              <button onClick={() => setShowNewCat(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Ícone</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(i => (
                  <button key={i} onClick={() => setNewCat(c => ({ ...c, icon: i }))}
                    className={`w-8 h-8 rounded-lg text-sm transition-all ${newCat.icon === i ? 'bg-cyan-500/30 ring-1 ring-cyan-500' : 'bg-white/5 hover:bg-white/10'}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Nome <span className="text-red-400">*</span></label>
              <input value={newCat.name} onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))}
                placeholder="Ex: TI & Infraestrutura"
                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Descrição</label>
              <textarea value={newCat.description} onChange={e => setNewCat(c => ({ ...c, description: e.target.value }))} rows={2}
                placeholder="Para que serve esta categoria?"
                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none" />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewCat(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={saveCategory} disabled={savingCat || !newCat.name}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-gray-900 font-semibold text-sm rounded-lg transition-colors">
                {savingCat ? 'Salvando…' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article: a }: { article: Article }) {
  const preview = a.summary || plainTextPreview(a.content, 120);
  return (
    <Link href={`/wiki/${a.slug}`}
      className="bg-gray-900 border border-white/5 hover:border-cyan-500/30 rounded-xl p-4 transition-all group block">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-white font-semibold group-hover:text-cyan-400 transition-colors leading-snug line-clamp-2">
          {a.pinned && <span className="mr-1 text-yellow-400">📌</span>}
          {a.title}
        </h3>
        {a.visibility !== 'public' && (
          <span className="shrink-0 text-[10px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded">
            {a.visibility === 'restricted' ? '🔒' : '🏢'}
          </span>
        )}
      </div>

      {preview && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{preview}</p>}

      <div className="flex items-center justify-between text-[11px] text-gray-600">
        <span>
          {a.category ? `${a.category.icon} ${a.category.name}` : '—'}
        </span>
        <span className="flex items-center gap-2">
          <span>👁 {a.views}</span>
          <span>·</span>
          <span>{timeAgo(a.updated_at)}</span>
        </span>
      </div>
    </Link>
  );
}
