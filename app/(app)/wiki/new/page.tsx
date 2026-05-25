'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { markdownToHtml } from '@/lib/utils/markdown';

interface Category {
  id: string;
  name: string;
  icon: string;
}

// ─── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES: { label: string; icon: string; content: string }[] = [
  {
    label: 'Procedimento / SOP',
    icon: '📋',
    content: `# Título do Procedimento

## Objetivo
Descreva brevemente o objetivo deste procedimento.

## Responsáveis
- **Responsável principal:**
- **Revisado por:**

## Pré-requisitos
- Item 1
- Item 2

## Passo a Passo

### 1. Primeira etapa
Descreva o que fazer.

### 2. Segunda etapa
Descreva o que fazer.

### 3. Terceira etapa
Descreva o que fazer.

## Pontos de Atenção
> ⚠️ Destaque aqui cuidados importantes ou erros comuns.

## Histórico de Alterações
| Data | Autor | Alteração |
|------|-------|-----------|
| 00/00/0000 | | Versão inicial |
`,
  },
  {
    label: 'Tutorial de Sistema',
    icon: '💻',
    content: `# Como usar: [Nome do Sistema]

## O que é este sistema?
Explique brevemente para que serve.

## Acesso
- **URL:**
- **Login:**
- **Quem tem acesso:**

## Funcionalidades Principais

### Função 1
Descreva como usar.

\`\`\`
Exemplo de comando ou ação
\`\`\`

### Função 2
Descreva como usar.

## Problemas Comuns

### Problema 1
**Sintoma:** O que acontece.
**Solução:** O que fazer.

## Contato para Suporte
Em caso de dúvidas, contate:
`,
  },
  {
    label: 'Política de RH',
    icon: '👥',
    content: `# Política: [Nome da Política]

**Versão:** 1.0
**Vigência:**

## 1. Objetivo
Descreva o objetivo desta política.

## 2. Abrangência
Esta política se aplica a:
- Todos os colaboradores da empresa
- Estagiários e terceiros (quando aplicável)

## 3. Diretrizes

### 3.1 Regra principal
Descreva a diretriz.

### 3.2 Exceções
Liste as exceções, se houver.

## 4. Responsabilidades
- **RH:**
- **Gestores:**
- **Colaboradores:**

## 5. Penalidades
O descumprimento desta política pode resultar em:

## 6. Aprovação
| Cargo | Nome | Assinatura |
|-------|------|-----------|
| Diretoria | | |
| RH | | |
`,
  },
  {
    label: 'Checklist',
    icon: '✅',
    content: `# Checklist: [Título]

**Responsável:**
**Data:**

## Antes de começar
- [ ] Verificar item 1
- [ ] Verificar item 2
- [ ] Verificar item 3

## Durante
- [ ] Executar passo 1
- [ ] Executar passo 2
- [ ] Executar passo 3

## Ao finalizar
- [ ] Confirmar resultado 1
- [ ] Confirmar resultado 2
- [x] Exemplo de item concluído

## Observações
`,
  },
  {
    label: 'Onboarding',
    icon: '🚀',
    content: `# Onboarding: [Cargo / Área]

Bem-vindo(a) à equipe! Este guia vai te ajudar nos primeiros dias.

## Semana 1 — Ambientação
- [ ] Receber equipamentos e acessos
- [ ] Conhecer a equipe
- [ ] Ler as políticas da empresa
- [ ] Configurar e-mail e ferramentas

## Ferramentas que você vai usar
| Ferramenta | Para quê | Quem te ajuda |
|------------|----------|---------------|
| | | |
| | | |

## Pessoas-chave para conhecer
- **Seu gestor direto:**
- **Time imediato:**
- **TI (suporte):**
- **RH:**

## Dúvidas frequentes
### Como faço para...?
Resposta aqui.

## Contatos Úteis
`,
  },
];

// ─── Autosave key ─────────────────────────────────────────────────────────────
function draftKey(articleId?: string) {
  return articleId ? `wiki_draft_edit_${articleId}` : 'wiki_draft_new';
}

// ─── Toolbar button ───────────────────────────────────────────────────────────
function ToolbarBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors font-mono"
    >
      {label}
    </button>
  );
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  const [showTemplates, setShowTemplates] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    fetch('/api/wiki/categories').then(r => r.json()).then(data => {
      setCategories(Array.isArray(data) ? data : []);
    });

    // Try to restore draft (only if no initialData or it's empty)
    if (!initialData) {
      try {
        const saved = localStorage.getItem(draftKey(articleId));
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft.content || draft.title) {
            setForm(f => ({ ...f, ...draft }));
            setDraftRestored(true);
          }
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave every 15s
  useEffect(() => {
    const key = draftKey(articleId);
    const interval = setInterval(() => {
      if (form.title || form.content) {
        localStorage.setItem(key, JSON.stringify({ title: form.title, content: form.content, summary: form.summary }));
        setLastSaved(new Date());
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [form, articleId]);

  function clearDraft() {
    localStorage.removeItem(draftKey(articleId));
    setDraftRestored(false);
  }

  // ─── Toolbar insert helpers ────────────────────────────────────────────────
  const insert = useCallback((before: string, after = '', placeholder = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = form.content.slice(start, end) || placeholder;
    const newContent =
      form.content.slice(0, start) +
      before + selected + after +
      form.content.slice(end);
    setForm(f => ({ ...f, content: newContent }));
    // Restore focus and cursor
    requestAnimationFrame(() => {
      el.focus();
      const newCursor = start + before.length + selected.length;
      el.setSelectionRange(newCursor, newCursor);
    });
  }, [form.content]);

  const insertLine = useCallback((prefix: string, placeholder = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = form.content.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = form.content.indexOf('\n', start);
    const end = lineEnd === -1 ? form.content.length : lineEnd;
    const line = form.content.slice(lineStart, end) || placeholder;
    const newContent = form.content.slice(0, lineStart) + prefix + line + form.content.slice(end);
    setForm(f => ({ ...f, content: newContent }));
    requestAnimationFrame(() => {
      el.focus();
      const newCursor = lineStart + prefix.length + line.length;
      el.setSelectionRange(newCursor, newCursor);
    });
  }, [form.content]);

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
      { method: articleId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar.'); setSaving(false); return; }

    clearDraft();
    router.push(`/wiki/${data.slug}`);
  }

  const isEditing = !!articleId;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{isEditing ? '✏️ Editar Artigo' : '✍️ Novo Artigo'}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {lastSaved ? `💾 Rascunho salvo às ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Rascunho salvo automaticamente a cada 15s'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={() => setShowTemplates(true)}
              className="px-3 py-2 text-sm bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 rounded-lg transition-colors"
            >
              🗂 Templates
            </button>
          )}
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
            {saving ? 'Salvando…' : isEditing ? 'Salvar' : 'Publicar'}
          </button>
        </div>
      </div>

      {/* Draft restored banner */}
      {draftRestored && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-400">📝 Rascunho anterior restaurado automaticamente.</p>
          <button onClick={clearDraft} className="text-xs text-amber-400/70 hover:text-amber-400 underline">Descartar</button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">{error}</div>
      )}

      {/* Metadata row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Categoria</label>
          <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500">
            <option value="">Sem categoria</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Visibilidade</label>
          <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500">
            <option value="public">🌐 Público</option>
            <option value="internal">🏢 Interno</option>
            <option value="restricted">🔒 Restrito</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Quem edita</label>
          <select value={form.edit_level} onChange={e => setForm(f => ({ ...f, edit_level: e.target.value }))}
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500">
            <option value="everyone">👥 Todos</option>
            <option value="admin_only">🔑 Só admin</option>
          </select>
        </div>
      </div>

      {/* Author + summary + pinned */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Autor</label>
          <input value={form.author_name} onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
            placeholder="Seu nome"
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Resumo (opcional)</label>
          <input value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
            placeholder="Uma linha descrevendo o artigo…"
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
              className={`w-9 h-5 rounded-full transition-colors ${form.pinned ? 'bg-cyan-500' : 'bg-gray-700'} relative`}>
              <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${form.pinned ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-gray-400">{form.pinned ? '📌 Fixado' : 'Fixar no topo'}</span>
          </label>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Título <span className="text-red-400">*</span></label>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Título do artigo…"
          className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-xl font-bold text-white placeholder-gray-700 focus:outline-none focus:border-cyan-500" />
      </div>

      {/* Change summary (edit mode) */}
      {isEditing && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Resumo da alteração</label>
          <input value={form.change_summary} onChange={e => setForm(f => ({ ...f, change_summary: e.target.value }))}
            placeholder="Ex: Adicionei seção de troubleshooting"
            className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
          <p className="text-[11px] text-gray-600 mt-1">Aparece no histórico de versões.</p>
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
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden focus-within:border-cyan-500 transition-colors">
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-3 py-2 border-b border-white/5 flex-wrap">
            <ToolbarBtn label="H1" title="Título H1" onClick={() => insertLine('# ', 'Título')} />
            <ToolbarBtn label="H2" title="Título H2" onClick={() => insertLine('## ', 'Seção')} />
            <ToolbarBtn label="H3" title="Título H3" onClick={() => insertLine('### ', 'Subseção')} />
            <div className="w-px h-4 bg-white/10 mx-1" />
            <ToolbarBtn label="B" title="Negrito" onClick={() => insert('**', '**', 'texto')} />
            <ToolbarBtn label="I" title="Itálico" onClick={() => insert('*', '*', 'texto')} />
            <ToolbarBtn label="S" title="Riscado" onClick={() => insert('~~', '~~', 'texto')} />
            <ToolbarBtn label="==" title="Destaque" onClick={() => insert('==', '==', 'destaque')} />
            <div className="w-px h-4 bg-white/10 mx-1" />
            <ToolbarBtn label="` `" title="Código inline" onClick={() => insert('`', '`', 'código')} />
            <ToolbarBtn label="```" title="Bloco de código" onClick={() => insert('```\n', '\n```', 'código aqui')} />
            <div className="w-px h-4 bg-white/10 mx-1" />
            <ToolbarBtn label="— lista" title="Lista com marcadores" onClick={() => insertLine('- ', 'item')} />
            <ToolbarBtn label="1. lista" title="Lista numerada" onClick={() => insertLine('1. ', 'item')} />
            <ToolbarBtn label="[ ] check" title="Checklist" onClick={() => insertLine('- [ ] ', 'item')} />
            <div className="w-px h-4 bg-white/10 mx-1" />
            <ToolbarBtn label="&gt; citar" title="Citação / nota" onClick={() => insertLine('> ', 'nota importante')} />
            <ToolbarBtn label="link" title="Link" onClick={() => insert('[', '](url)', 'texto do link')} />
            <ToolbarBtn label="tabela" title="Inserir tabela"
              onClick={() => setForm(f => ({
                ...f,
                content: f.content + '\n\n| Coluna 1 | Coluna 2 | Coluna 3 |\n|----------|----------|----------|\n| linha 1  | valor    | valor    |\n| linha 2  | valor    | valor    |\n'
              }))} />
            <ToolbarBtn label="---" title="Linha divisória" onClick={() => setForm(f => ({ ...f, content: f.content + '\n\n---\n\n' }))} />
          </div>

          <textarea
            ref={textareaRef}
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder={`# Título da seção\n\nComece a escrever aqui. Use a barra de ferramentas acima ou markdown diretamente.\n\n## Seção\n\nParágrafo normal.\n\n- Item de lista\n- Outro item\n\n> Nota ou destaque importante`}
            rows={28}
            className="w-full bg-transparent px-4 py-3 text-sm text-gray-200 placeholder-gray-700 focus:outline-none font-mono resize-y"
          />

          <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
            <p className="text-[11px] text-gray-600">
              Markdown suportado · **negrito** · *itálico* · `código` · # títulos · - listas · tabelas · ==destaque==
            </p>
            <p className="text-[11px] text-gray-600">{form.content.split(/\s+/).filter(Boolean).length} palavras</p>
          </div>
        </div>
      )}

      {/* Templates modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="text-lg font-semibold text-white">🗂 Galeria de Templates</h2>
                <p className="text-xs text-gray-500 mt-0.5">Selecione um modelo para começar mais rápido</p>
              </div>
              <button onClick={() => setShowTemplates(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
              {TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => {
                    setForm(f => ({ ...f, content: t.content, title: f.title || t.label }));
                    setShowTemplates(false);
                  }}
                  className="text-left bg-gray-800 hover:bg-gray-700 border border-white/5 hover:border-cyan-500/30 rounded-xl p-4 transition-all group"
                >
                  <p className="text-2xl mb-2">{t.icon}</p>
                  <p className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">{t.label}</p>
                  <p className="text-[11px] text-gray-600 mt-1 line-clamp-2">
                    {t.content.replace(/^#+ /gm, '').replace(/\n/g, ' ').slice(0, 80)}…
                  </p>
                </button>
              ))}
            </div>
            <div className="px-6 py-3 border-t border-white/5 text-[11px] text-gray-600">
              Selecionar um template preenche o conteúdo — você pode editar livremente depois.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
