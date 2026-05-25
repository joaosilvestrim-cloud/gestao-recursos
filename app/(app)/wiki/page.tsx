'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { plainTextPreview, fuzzyMatch } from '@/lib/utils/markdown';

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  slug: string;
  order_index: number;
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

const STORAGE_RECENTS = 'wiki_recents_v1';
const STORAGE_FAVS = 'wiki_favs_v1';

function getRecents(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_RECENTS) ?? '[]'); } catch { return []; }
}
function getFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_FAVS) ?? '[]'); } catch { return []; }
}
function toggleFav(id: string): string[] {
  const favs = getFavs();
  const next = favs.includes(id) ? favs.filter(x => x !== id) : [id, ...favs];
  localStorage.setItem(STORAGE_FAVS, JSON.stringify(next));
  return next;
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [favs, setFavs] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: '📄', description: '' });
  const [savingCat, setSavingCat] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [cats, arts] = await Promise.all([
      fetch('/api/wiki/categories').then(r => r.json()),
      fetch('/api/wiki/articles').then(r => r.json()),
    ]);
    setCategories(Array.isArray(cats) ? cats : []);
    setArticles(Array.isArray(arts) ? arts : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    setFavs(getFavs());
    setRecents(getRecents());
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Autocomplete suggestions (top 5 fuzzy matches)
  const suggestions = useMemo(() => {
    if (search.length < 2) return [];
    return articles
      .filter(a => fuzzyMatch(a.title, search) || fuzzyMatch(a.summary ?? '', search))
      .slice(0, 5);
  }, [articles, search]);

  const filtered = useMemo(() => {
    let list = articles;
    if (activeCategory) list = list.filter(a => a.category_id === activeCategory);
    if (search) list = list.filter(a =>
      fuzzyMatch(a.title, search) ||
      fuzzyMatch(a.summary ?? '', search) ||
      fuzzyMatch(plainTextPreview(a.content), search)
    );
    return list;
  }, [articles, activeCategory, search]);

  const pinned = filtered.filter(a => a.pinned);
  const regular = filtered.filter(a => !a.pinned);

  const favArticles = useMemo(() => articles.filter(a => favs.includes(a.id)), [articles, favs]);
  const recentArticles = useMemo(() =>
    recents.map(id => articles.find(a => a.id === id)).filter(Boolean) as Article[],
    [articles, recents]);

  function handleToggleFav(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFavs(toggleFav(id));
  }

  async function saveCategory() {
    if (!newCat.name) return;
    setSavingCat(true);
    await fetch('/api/wiki/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCat) });
    setSavingCat(false);
    setShowNewCat(false);
    setNewCat({ name: '', icon: '📄', description: '' });
    load();
  }

  const ICONS = ['📄', '🚀', '⚙️', '💰', '💻', '👥', '📁', '🎯', '📊', '🔧', '📋', '🌐', '🔐', '📚', '💡', '🎓', '📝', '🔔', '❓', '✅'];

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

  const isFiltering = !!search || !!activeCategory;

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar — categories */}
      <aside className="w-60 shrink-0 border-r border-white/5 p-4 space-y-1 sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Categorias</p>
          <button
            onClick={() => setShowNewCat(true)}
            className="w-5 h-5 rounded text-gray-500 hover:text-white hover:bg-white/10 text-sm flex items-center justify-center transition-colors"
            title="Nova categoria"
          >+</button>
        </div>

        <button
          onClick={() => { setActiveCategory(''); setSearch(''); }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
            activeCategory === '' && !search ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📚</span>
          <span className="flex-1 text-left">Todos</span>
          <span className="text-[11px] text-gray-600">{articles.length}</span>
        </button>

        {favArticles.length > 0 && (
          <button
            onClick={() => setActiveCategory('__favs__')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
              activeCategory === '__favs__' ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>⭐</span>
            <span className="flex-1 text-left">Favoritos</span>
            <span className="text-[11px] text-gray-600">{favArticles.length}</span>
          </button>
        )}

        <div className="h-px bg-white/5 my-2" />

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
              Base de conhecimento da equipe — processos, onboarding, políticas e documentação técnica.
            </p>
          </div>
          <Link
            href="/wiki/new"
            className="shrink-0 bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5"
          >
            ✍️ Novo Artigo
          </Link>
        </div>

        {/* Search with autocomplete */}
        <div ref={searchRef} className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Buscar por título, conteúdo… (suporta erros de digitação)"
            className="w-full bg-gray-900 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          {search && (
            <button onClick={() => { setSearch(''); setShowSuggestions(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-lg leading-none">×</button>
          )}

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && search.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
              {suggestions.map(a => (
                <Link
                  key={a.id}
                  href={`/wiki/${a.slug}`}
                  onClick={() => setShowSuggestions(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                >
                  <span className="text-lg">{a.category?.icon ?? '📄'}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 font-medium truncate">{a.title}</p>
                    {a.category && <p className="text-[11px] text-gray-600">{a.category.name}</p>}
                  </div>
                  <span className="ml-auto text-[10px] text-gray-600 shrink-0">↵ abrir</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Home view — no filters active */}
        {!isFiltering && activeCategory !== '__favs__' && (
          <>
            {/* Recents */}
            {recentArticles.length > 0 && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">🕐 Vistos Recentemente</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {recentArticles.slice(0, 6).map(a => (
                    <Link key={a.id} href={`/wiki/${a.slug}`}
                      className="shrink-0 w-52 bg-gray-900 border border-white/5 hover:border-cyan-500/30 rounded-xl p-3 transition-all group">
                      <p className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors line-clamp-2 leading-snug mb-1">{a.title}</p>
                      <p className="text-[11px] text-gray-600">{a.category?.icon} {a.category?.name ?? '—'}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Favorites */}
            {favArticles.length > 0 && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">⭐ Favoritos</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {favArticles.map(a => (
                    <ArticleCard key={a.id} article={a} isFav={favs.includes(a.id)} onToggleFav={handleToggleFav} />
                  ))}
                </div>
              </section>
            )}

            {/* Categories grid — when no articles yet */}
            {articles.length === 0 && categories.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                    className="bg-gray-900 border border-white/5 hover:border-cyan-500/30 rounded-xl p-5 text-left transition-all group">
                    <p className="text-2xl mb-2">{cat.icon}</p>
                    <p className="text-white font-semibold group-hover:text-cyan-400 transition-colors">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{cat.description}</p>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Favorites view */}
        {activeCategory === '__favs__' && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">⭐ Favoritos</p>
            {favArticles.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <p className="text-3xl mb-2">⭐</p>
                <p>Nenhum artigo favoritado ainda.</p>
                <p className="text-sm mt-1">Clique na ⭐ em qualquer artigo para salvar aqui.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {favArticles.map(a => (
                  <ArticleCard key={a.id} article={a} isFav={true} onToggleFav={handleToggleFav} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filtered view */}
        {isFiltering && activeCategory !== '__favs__' && (
          <>
            {/* Category header */}
            {activeCategory && activeCategory !== '__favs__' && (() => {
              const cat = categories.find(c => c.id === activeCategory);
              return cat ? (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <p className="text-white font-semibold text-lg">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-500">{cat.description}</p>}
                  </div>
                </div>
              ) : null;
            })()}

            {pinned.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">📌 Fixados</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pinned.map(a => <ArticleCard key={a.id} article={a} isFav={favs.includes(a.id)} onToggleFav={handleToggleFav} />)}
                </div>
              </div>
            )}

            {regular.length === 0 && pinned.length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-lg font-medium text-gray-500">Nenhum artigo encontrado</p>
                <p className="text-sm mt-1">Tente outros termos de busca ou outra categoria.</p>
              </div>
            ) : regular.length > 0 ? (
              <div>
                {(pinned.length > 0 || search) && (
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">
                    {search ? `${regular.length + pinned.length} resultado(s) para "${search}"` : 'Artigos'}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {regular.map(a => <ArticleCard key={a.id} article={a} isFav={favs.includes(a.id)} onToggleFav={handleToggleFav} />)}
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* All articles — home without filters */}
        {!isFiltering && activeCategory !== '__favs__' && articles.length > 0 && (
          <section>
            {pinned.length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">📌 Fixados</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pinned.map(a => <ArticleCard key={a.id} article={a} isFav={favs.includes(a.id)} onToggleFav={handleToggleFav} />)}
                </div>
              </div>
            )}
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3">
              {pinned.length > 0 ? 'Todos os Artigos' : 'Artigos'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {regular.map(a => <ArticleCard key={a.id} article={a} isFav={favs.includes(a.id)} onToggleFav={handleToggleFav} />)}
            </div>
          </section>
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

function ArticleCard({ article: a, isFav, onToggleFav }: {
  article: Article;
  isFav: boolean;
  onToggleFav: (id: string, e: React.MouseEvent) => void;
}) {
  const preview = a.summary || plainTextPreview(a.content, 120);
  return (
    <Link href={`/wiki/${a.slug}`}
      className="bg-gray-900 border border-white/5 hover:border-cyan-500/30 rounded-xl p-4 transition-all group block relative">
      {/* Fav button */}
      <button
        onClick={(e) => onToggleFav(a.id, e)}
        className={`absolute top-3 right-3 text-sm transition-all ${isFav ? 'opacity-100 text-yellow-400' : 'opacity-0 group-hover:opacity-100 text-gray-600 hover:text-yellow-400'}`}
        title={isFav ? 'Remover dos favoritos' : 'Favoritar'}
      >⭐</button>

      <div className="flex items-start gap-2 mb-2 pr-6">
        <h3 className="text-white font-semibold group-hover:text-cyan-400 transition-colors leading-snug line-clamp-2">
          {a.pinned && <span className="mr-1 text-yellow-400">📌</span>}
          {a.title}
        </h3>
      </div>

      {preview && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{preview}</p>}

      <div className="flex items-center justify-between text-[11px] text-gray-600">
        <span>{a.category ? `${a.category.icon} ${a.category.name}` : '—'}</span>
        <span className="flex items-center gap-2">
          <span>👁 {a.views}</span>
          <span>·</span>
          <span>{timeAgo(a.updated_at)}</span>
        </span>
      </div>
    </Link>
  );
}
