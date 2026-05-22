'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { markdownToHtml } from '@/lib/utils/markdown';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  author_name: string | null;
  visibility: string;
  edit_level: string;
  pinned: boolean;
  views: number;
  created_at: string;
  updated_at: string;
  category: { id: string; name: string; icon: string; slug: string } | null;
}

interface Version {
  id: string;
  version_number: number;
  title: string;
  changed_by: string | null;
  change_summary: string | null;
  created_at: string;
}

interface Comment {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  const [article, setArticle] = useState<Article | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newComment, setNewComment] = useState({ author_name: '', content: '' });
  const [postingComment, setPostingComment] = useState(false);

  async function loadArticle() {
    const res = await fetch(`/api/wiki/articles/${slug}`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const data = await res.json();
    setArticle(data);

    const [vers, comms] = await Promise.all([
      fetch(`/api/wiki/articles/${data.id}/versions`).then(r => r.json()),
      fetch(`/api/wiki/articles/${data.id}/comments`).then(r => r.json()),
    ]);
    setVersions(Array.isArray(vers) ? vers : []);
    setComments(Array.isArray(comms) ? comms : []);
    setLoading(false);
  }

  useEffect(() => { loadArticle(); }, [slug]);

  async function deleteArticle() {
    if (!article) return;
    if (!confirm('Excluir este artigo permanentemente?')) return;
    await fetch(`/api/wiki/articles/${article.id}`, { method: 'DELETE' });
    router.push('/wiki');
  }

  async function togglePin() {
    if (!article) return;
    await fetch(`/api/wiki/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !article.pinned }),
    });
    loadArticle();
  }

  async function postComment() {
    if (!article || !newComment.author_name || !newComment.content) return;
    setPostingComment(true);
    await fetch(`/api/wiki/articles/${article.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newComment),
    });
    setNewComment({ author_name: '', content: '' });
    const comms = await fetch(`/api/wiki/articles/${article.id}/comments`).then(r => r.json());
    setComments(Array.isArray(comms) ? comms : []);
    setPostingComment(false);
  }

  async function deleteComment(id: string) {
    if (!confirm('Excluir comentário?')) return;
    await fetch(`/api/wiki/comments/${id}`, { method: 'DELETE' });
    setComments(c => c.filter(x => x.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="p-8 text-center">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-xl font-semibold text-white">Artigo não encontrado</p>
        <Link href="/wiki" className="mt-4 inline-block text-cyan-400 hover:underline text-sm">← Voltar para a Wiki</Link>
      </div>
    );
  }

  return (
    <div className="flex gap-6 p-6 max-w-6xl mx-auto">
      {/* Article */}
      <article className="flex-1 min-w-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-4">
          <Link href="/wiki" className="hover:text-gray-400 transition-colors">Wiki</Link>
          {article.category && (
            <>
              <span>›</span>
              <span className="text-gray-500">{article.category.icon} {article.category.name}</span>
            </>
          )}
          <span>›</span>
          <span className="text-gray-400 truncate">{article.title}</span>
        </div>

        {/* Title + actions */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-3xl font-bold text-white leading-tight">
            {article.pinned && <span className="text-yellow-400 mr-2">📌</span>}
            {article.title}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={togglePin} title={article.pinned ? 'Desafixar' : 'Fixar'}
              className="px-2.5 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-400 hover:text-yellow-400 rounded-lg transition-colors">
              {article.pinned ? '📌' : '📍'}
            </button>
            <Link href={`/wiki/${article.slug}/edit`}
              className="px-3 py-1.5 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors">
              ✏️ Editar
            </Link>
            <button onClick={deleteArticle}
              className="px-2.5 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
              🗑
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-[11px] text-gray-600 mb-6 flex-wrap">
          {article.author_name && <span>✍️ {article.author_name}</span>}
          <span>📅 Criado em {fmtDate(article.created_at)}</span>
          {article.updated_at !== article.created_at && <span>🔄 Atualizado em {fmtDate(article.updated_at)}</span>}
          <span>👁 {article.views} visualizações</span>
          <span className={`px-2 py-0.5 rounded border text-[10px] ${
            article.visibility === 'public' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
            article.visibility === 'internal' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
            'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
          }`}>
            {article.visibility === 'public' ? '🌐 Público' : article.visibility === 'internal' ? '🏢 Interno' : '🔒 Restrito'}
          </span>
          {article.edit_level === 'admin_only' && (
            <span className="px-2 py-0.5 rounded border border-purple-500/30 text-purple-400 bg-purple-500/10 text-[10px]">🔑 Só admin edita</span>
          )}
        </div>

        {/* Summary */}
        {article.summary && (
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 mb-6 text-sm text-cyan-300">
            {article.summary}
          </div>
        )}

        {/* Content */}
        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(article.content) }}
        />

        {/* Comments */}
        <div className="mt-10 border-t border-white/5 pt-8">
          <h3 className="text-lg font-semibold text-white mb-4">
            💬 Comentários {comments.length > 0 && <span className="text-gray-600 font-normal text-sm">({comments.length})</span>}
          </h3>

          {comments.length === 0 && (
            <p className="text-gray-600 text-sm mb-6">Nenhum comentário ainda. Seja o primeiro!</p>
          )}

          <div className="space-y-4 mb-6">
            {comments.map(c => (
              <div key={c.id} className="bg-gray-900 border border-white/5 rounded-xl p-4 group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-xs font-bold text-cyan-300">
                      {c.author_name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-200">{c.author_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-600">{fmtDate(c.created_at)}</span>
                    <button onClick={() => deleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-[11px] text-red-400/60 hover:text-red-400 transition-all">✕</button>
                  </div>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>

          {/* New comment form */}
          <div className="bg-gray-900 border border-white/5 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-gray-300">Adicionar comentário</p>
            <input
              value={newComment.author_name}
              onChange={e => setNewComment(c => ({ ...c, author_name: e.target.value }))}
              placeholder="Seu nome"
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
            />
            <textarea
              value={newComment.content}
              onChange={e => setNewComment(c => ({ ...c, content: e.target.value }))}
              placeholder="Escreva seu comentário, dúvida ou sugestão…"
              rows={3}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none"
            />
            <div className="flex justify-end">
              <button
                onClick={postComment}
                disabled={postingComment || !newComment.author_name || !newComment.content}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-gray-900 font-semibold text-sm rounded-lg transition-colors"
              >
                {postingComment ? 'Enviando…' : 'Comentar'}
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Sidebar — version history */}
      <aside className="w-64 shrink-0 space-y-4">
        <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:bg-white/3 transition-colors"
          >
            <span>🕐 Histórico</span>
            <span className="text-gray-600 text-xs">{versions.length} versões {showHistory ? '▲' : '▼'}</span>
          </button>

          {showHistory && (
            <div className="border-t border-white/5 max-h-80 overflow-y-auto">
              {versions.map(v => (
                <div key={v.id} className="px-4 py-3 border-b border-white/5 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-cyan-400">v{v.version_number}</span>
                    <span className="text-[11px] text-gray-600">{fmtDate(v.created_at)}</span>
                  </div>
                  {v.changed_by && <p className="text-[11px] text-gray-500">por {v.changed_by}</p>}
                  {v.change_summary && <p className="text-[11px] text-gray-600 italic mt-0.5">{v.change_summary}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category info */}
        {article.category && (
          <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-gray-600 uppercase tracking-wider mb-2">Categoria</p>
            <p className="text-sm text-gray-300 font-medium">{article.category.icon} {article.category.name}</p>
          </div>
        )}

        <Link href="/wiki" className="block text-center text-xs text-gray-600 hover:text-gray-400 transition-colors py-2">
          ← Voltar para a Wiki
        </Link>
      </aside>
    </div>
  );
}
