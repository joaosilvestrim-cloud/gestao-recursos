'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { plainTextPreview, fuzzyMatch, readingTime } from '@/lib/utils/markdown';

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

// Category gradient palette
const CAT_GRADIENTS = [
  'from-cyan-500/20 to-blue-600/10 border-cyan-500/20',
  'from-purple-500/20 to-pink-600/10 border-purple-500/20',
  'from-green-500/20 to-emerald-600/10 border-green-500/20',
  'from-orange-500/20 to-yellow-600/10 border-orange-500/20',
  'from-blue-500/20 to-indigo-600/10 border-blue-500/20',
  'from-pink-500/20 to-rose-600/10 border-pink-500/20',
  'from-teal-500/20 to-cyan-600/10 border-teal-500/20',
  'from-amber-500/20 to-orange-600/10 border-amber-500/20',
];

export default function WikiPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = useMemo(() => {
    if (search.length < 2) return [];
    return articles.filter(a => fuzzyMatch(a.title, search) || fuzzyMatch(a.summary ?? '', search)).slice(0, 6);
  }, [articles, search]);

  const filtered = useMemo(() => {
    let list = articles;
    if (activeCategory === '__favs__') return articles.filter(a => favs.includes(a.id));
    if (activeCategory) list = list.filter(a => a.category_id === activeCategory);
    if (search) list = list.filter(a =>
      fuzzyMatch(a.title, search) || fuzzyMatch(a.summary ?? '', search) ||
      fuzzyMatch(plainTextPreview(a.content), search)
    );
    return list;
  }, [articles, activeCategory, search, favs]);

  const favArticles = useMemo(() => articles.filter(a => favs.includes(a.id)), [articles, favs]);
  const recentArticles = useMemo(() =>
    recents.map(id => articles.find(a => a.id === id)).filter(Boolean) as Article[],
    [articles, recents]);

  function handleToggleFav(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setFavs(toggleFav(id));
  }

  async function saveCategory() {
    if (!newCat.name) return;
    setSavingCat(true);
    await fetch('/api/wiki/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCat) });
    setSavingCat(false); setShowNewCat(false);
    setNewCat({ name: '', icon: '📄', description: '' });
    load();
  }

  const ICONS = ['📄','🚀','⚙️','💰','💻','👥','📁','🎯','📊','🔧','📋','🌐','🔐','📚','💡','🎓','📝','🔔','❓','✅'];

  const isSearching = search.length > 0;
  const isBrowsingCategory = !!activeCategory && activeCategory !== '__favs__';
  const isBrowsingFavs = activeCategory === '__favs__';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Carregando base de conhecimento…</p>
        </div>
      </div>
    );
  }

  const pinned = filtered.filter(a => a.pinned);
  const regular = filtered.filter(a => !a.pinned);

  return (
    <div className="min-h-screen bg-gray-950">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 border-b border-white/5">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 py-14 text-center">
          {/* Breadcrumb or back button */}
          {(isBrowsingCategory || isBrowsingFavs || isSearching) && (
            <button onClick={() => { setActiveCategory(null); setSearch(''); }}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-6 transition-colors">
              ← Voltar para o início
            </button>
          )}

          {/* Logo / Icon */}
          {!isBrowsingCategory && !isSearching && !isBrowsingFavs && (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 mb-5 text-3xl">
              📚
            </div>
          )}

          <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
            {isBrowsingCategory
              ? (() => { const cat = categories.find(c => c.id === activeCategory); return cat ? `${cat.icon} ${cat.name}` : 'Categoria'; })()
              : isBrowsingFavs ? '⭐ Seus Favoritos'
              : isSearching ? `Resultados para "${search}"`
              : 'Wiki da Drive Data'}
          </h1>
          <p className="text-gray-400 text-base mb-8 max-w-xl mx-auto">
            {isBrowsingCategory
              ? (() => { const cat = categories.find(c => c.id === activeCategory); return cat?.description ?? 'Artigos desta categoria'; })()
              : isBrowsingFavs ? 'Artigos que você marcou como favorito'
              : isSearching ? `${filtered.length} artigo(s) encontrado(s)`
              : 'Base de conhecimento centralizada da equipe — processos, onboarding, políticas e documentação técnica.'}
          </p>

          {/* Search bar */}
          <div ref={searchRef} className="relative max-w-2xl mx-auto">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSuggestions(true); setActiveCategory(null); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Pesquisar artigos, processos, políticas…"
              className="w-full bg-gray-900/80 border border-white/10 rounded-2xl pl-12 pr-12 py-4 text-base text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-gray-900 transition-all shadow-lg"
            />
            {search && (
              <button onClick={() => { setSearch(''); setShowSuggestions(false); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xl transition-colors">×</button>
            )}

            {/* Autocomplete */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-30 overflow-hidden">
                {suggestions.map(a => (
                  <Link key={a.id} href={`/wiki/${a.slug}`}
                    onClick={() => setShowSuggestions(false)}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    <span className="text-xl w-7 text-center shrink-0">{a.category?.icon ?? '📄'}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-gray-200 truncate">{a.title}</p>
                      <p className="text-[11px] text-gray-500">{a.category?.name ?? 'Sem categoria'} · {timeAgo(a.updated_at)}</p>
                    </div>
                    <span className="text-[10px] text-gray-600 shrink-0 bg-white/5 px-2 py-0.5 rounded">↵</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Stats row */}
          {!isSearching && !isBrowsingCategory && !isBrowsingFavs && articles.length > 0 && (
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-500">
              <span><strong className="text-gray-300">{articles.length}</strong> artigos</span>
              <span className="text-gray-700">·</span>
              <span><strong className="text-gray-300">{categories.length}</strong> categorias</span>
              {favArticles.length > 0 && (
                <>
                  <span className="text-gray-700">·</span>
                  <button onClick={() => setActiveCategory('__favs__')}
                    className="hover:text-yellow-400 transition-colors">
                    ⭐ <strong className="text-gray-300">{favArticles.length}</strong> favoritos
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* ── Home view ── */}
        {!isSearching && !isBrowsingCategory && !isBrowsingFavs && (
          <>
            {/* Categories grid */}
            {categories.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Navegar por categoria</h2>
                  <button onClick={() => setShowNewCat(true)}
                    className="text-xs text-gray-600 hover:text-cyan-400 transition-colors flex items-center gap-1">
                    + Nova categoria
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {categories.map((cat, i) => {
                    const count = articles.filter(a => a.category_id === cat.id).length;
                    const grad = CAT_GRADIENTS[i % CAT_GRADIENTS.length];
                    return (
                      <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                        className={`bg-gradient-to-br ${grad} border rounded-2xl p-5 text-left transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 group`}>
                        <p className="text-3xl mb-3">{cat.icon}</p>
                        <p className="text-sm font-semibold text-white group-hover:text-white leading-tight mb-1">{cat.name}</p>
                        {cat.description && (
                          <p className="text-[11px] text-gray-500 line-clamp-2 mb-2">{cat.description}</p>
                        )}
                        <p className="text-[11px] text-gray-600">{count} {count === 1 ? 'artigo' : 'artigos'}</p>
                      </button>
                    );
                  })}
                  {/* Add category tile */}
                  <button onClick={() => setShowNewCat(true)}
                    className="border border-dashed border-white/10 hover:border-cyan-500/30 rounded-2xl p-5 text-left transition-all group flex flex-col items-center justify-center gap-2 min-h-[120px]">
                    <span className="text-2xl text-gray-700 group-hover:text-cyan-500 transition-colors">+</span>
                    <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">Criar categoria</span>
                  </button>
                </div>
              </section>
            )}

            {/* Recents */}
            {recentArticles.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">🕐 Vistos recentemente</h2>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                  {recentArticles.slice(0, 6).map(a => (
                    <Link key={a.id} href={`/wiki/${a.slug}`}
                      className="shrink-0 w-56 bg-gray-900 hover:bg-gray-800 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all group">
                      <p className="text-xs text-gray-600 mb-1.5">{a.category?.icon} {a.category?.name ?? '—'}</p>
                      <p className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors line-clamp-2 leading-snug">{a.title}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Favorites strip */}
            {favArticles.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">⭐ Seus favoritos</h2>
                  <button onClick={() => setActiveCategory('__favs__')}
                    className="text-xs text-gray-600 hover:text-yellow-400 transition-colors">Ver todos →</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {favArticles.slice(0, 3).map(a => (
                    <ArticleCard key={a.id} article={a} isFav={true} onToggleFav={handleToggleFav} />
                  ))}
                </div>
              </section>
            )}

            {/* Pinned articles */}
            {pinned.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">📌 Fixados</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pinned.map(a => <ArticleCardFeatured key={a.id} article={a} isFav={favs.includes(a.id)} onToggleFav={handleToggleFav} />)}
                </div>
              </section>
            )}

            {/* All articles */}
            {regular.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
                  {pinned.length > 0 ? 'Todos os artigos' : 'Artigos'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {regular.map(a => <ArticleCard key={a.id} article={a} isFav={favs.includes(a.id)} onToggleFav={handleToggleFav} />)}
                </div>
              </section>
            )}

            {/* Empty state */}
            {articles.length === 0 && categories.length === 0 && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-900 border border-white/5 text-4xl mb-5">📭</div>
                <p className="text-xl font-semibold text-white mb-2">A wiki está vazia</p>
                <p className="text-gray-500 mb-6">Crie o primeiro artigo ou comece por uma categoria.</p>
                <Link href="/wiki/new"
                  className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
                  ✍️ Criar primeiro artigo
                </Link>
              </div>
            )}
          </>
        )}

        {/* ── Category / Favs / Search view ── */}
        {(isSearching || isBrowsingCategory || isBrowsingFavs) && (
          <>
            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🔍</p>
                <p className="text-lg font-semibold text-white mb-2">Nenhum artigo encontrado</p>
                <p className="text-gray-500 text-sm">Tente outros termos ou navegue por categorias.</p>
              </div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <section className="mb-8">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">📌 Fixados</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pinned.map(a => <ArticleCardFeatured key={a.id} article={a} isFav={favs.includes(a.id)} onToggleFav={handleToggleFav} />)}
                    </div>
                  </section>
                )}
                {regular.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
                      {isSearching ? `${filtered.length} resultado(s)` : pinned.length > 0 ? 'Demais artigos' : 'Artigos'}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {regular.map(a => <ArticleCard key={a.id} article={a} isFav={favs.includes(a.id)} onToggleFav={handleToggleFav} />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* New Article FAB */}
        <div className="fixed bottom-6 right-6 z-20">
          <Link href="/wiki/new"
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold px-5 py-3 rounded-2xl text-sm shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 hover:shadow-cyan-500/30">
            ✍️ Novo Artigo
          </Link>
        </div>
      </div>

      {/* ── New Category Modal ─────────────────────────────────── */}
      {showNewCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Nova Categoria</h2>
              <button onClick={() => setShowNewCat(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Ícone</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(i => (
                  <button key={i} onClick={() => setNewCat(c => ({ ...c, icon: i }))}
                    className={`w-9 h-9 rounded-xl text-base transition-all ${newCat.icon === i ? 'bg-cyan-500/30 ring-1 ring-cyan-500' : 'bg-white/5 hover:bg-white/10'}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nome <span className="text-red-400">*</span></label>
              <input value={newCat.name} onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))}
                placeholder="Ex: TI & Infraestrutura"
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Descrição</label>
              <textarea value={newCat.description} onChange={e => setNewCat(c => ({ ...c, description: e.target.value }))} rows={2}
                placeholder="Para que serve esta categoria?"
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowNewCat(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancelar</button>
              <button onClick={saveCategory} disabled={savingCat || !newCat.name}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-gray-900 font-semibold text-sm rounded-xl transition-colors">
                {savingCat ? 'Criando…' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Article card (compact grid) ───────────────────────────────────────────────
function ArticleCard({ article: a, isFav, onToggleFav }: {
  article: Article; isFav: boolean;
  onToggleFav: (id: string, e: React.MouseEvent) => void;
}) {
  const preview = a.summary || plainTextPreview(a.content, 100);
  const mins = readingTime(a.content);
  return (
    <Link href={`/wiki/${a.slug}`}
      className="bg-gray-900 hover:bg-gray-800/80 border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all group block relative">
      <button onClick={e => onToggleFav(a.id, e)}
        className={`absolute top-4 right-4 text-sm transition-all ${isFav ? 'opacity-100 text-yellow-400' : 'opacity-0 group-hover:opacity-100 text-gray-700 hover:text-yellow-400'}`}
        title={isFav ? 'Remover favorito' : 'Favoritar'}>⭐</button>

      {/* Category tag */}
      {a.category && (
        <span className="inline-flex items-center gap-1 text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full mb-3">
          {a.category.icon} {a.category.name}
        </span>
      )}

      <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors leading-snug line-clamp-2 pr-5 mb-2">
        {a.pinned && <span className="mr-1 text-yellow-400">📌</span>}
        {a.title}
      </h3>

      {preview && <p className="text-xs text-gray-600 line-clamp-2 mb-4">{preview}</p>}

      <div className="flex items-center justify-between text-[11px] text-gray-700">
        <span>{timeAgo(a.updated_at)}</span>
        <div className="flex items-center gap-2">
          <span>⏱ {mins}min</span>
          <span>·</span>
          <span>👁 {a.views}</span>
        </div>
      </div>
    </Link>
  );
}

// ── Featured article card (pinned, larger) ────────────────────────────────────
function ArticleCardFeatured({ article: a, isFav, onToggleFav }: {
  article: Article; isFav: boolean;
  onToggleFav: (id: string, e: React.MouseEvent) => void;
}) {
  const preview = a.summary || plainTextPreview(a.content, 160);
  const mins = readingTime(a.content);
  return (
    <Link href={`/wiki/${a.slug}`}
      className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-white/8 hover:border-cyan-500/20 rounded-2xl p-6 transition-all group block relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

      <button onClick={e => onToggleFav(a.id, e)}
        className={`absolute top-5 right-5 text-sm transition-all ${isFav ? 'opacity-100 text-yellow-400' : 'opacity-0 group-hover:opacity-100 text-gray-700 hover:text-yellow-400'}`}>⭐</button>

      {a.category && (
        <span className="inline-flex items-center gap-1 text-[10px] text-cyan-500/70 bg-cyan-500/10 border border-cyan-500/15 px-2 py-0.5 rounded-full mb-3">
          {a.category.icon} {a.category.name}
        </span>
      )}

      <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors leading-snug pr-6 mb-2">
        📌 {a.title}
      </h3>

      {preview && <p className="text-sm text-gray-500 line-clamp-2 mb-5">{preview}</p>}

      <div className="flex items-center gap-3 text-[11px] text-gray-600">
        {a.author_name && <span>✍️ {a.author_name}</span>}
        <span>⏱ {mins} min</span>
        <span>·</span>
        <span>{timeAgo(a.updated_at)}</span>
      </div>
    </Link>
  );
}
