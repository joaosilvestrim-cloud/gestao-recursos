'use client';

import { useEffect, useState, use } from 'react';
import { ArticleEditor } from '../../new/page';

export default function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<null | {
    title: string; content: string; summary: string; category_id: string;
    author_name: string; visibility: string; edit_level: string; pinned: boolean;
  }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/wiki/articles/${slug}`)
      .then(r => r.json())
      .then(data => {
        setArticleId(data.id);
        setInitialData({
          title: data.title ?? '',
          content: data.content ?? '',
          summary: data.summary ?? '',
          category_id: data.category_id ?? '',
          author_name: data.author_name ?? '',
          visibility: data.visibility ?? 'public',
          edit_level: data.edit_level ?? 'everyone',
          pinned: data.pinned ?? false,
        });
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!articleId || !initialData) {
    return <div className="p-8 text-center text-gray-500">Artigo não encontrado.</div>;
  }

  return <ArticleEditor articleId={articleId} initialData={initialData} />;
}
