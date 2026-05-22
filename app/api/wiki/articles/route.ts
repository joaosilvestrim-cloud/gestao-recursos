import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category_id');
  const search = searchParams.get('q');
  const pinned = searchParams.get('pinned');

  let query = supabase
    .from('wiki_articles')
    .select('id, title, slug, summary, category_id, author_name, visibility, edit_level, pinned, views, created_at, updated_at, category:wiki_categories(id, name, icon, slug)')
    .is('deleted_at', null)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (category) query = query.eq('category_id', category);
  if (search) query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%,content.ilike.%${search}%`);
  if (pinned === '1') query = query.eq('pinned', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  // auto-generate slug
  if (!body.slug) {
    const base = body.title
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);
    body.slug = `${base}-${Date.now().toString(36)}`;
  }

  const { data, error } = await supabase.from('wiki_articles').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Save initial version
  await supabase.from('wiki_article_versions').insert({
    article_id: data.id,
    content: data.content,
    title: data.title,
    version_number: 1,
    changed_by: body.author_name ?? 'Admin',
    change_summary: 'Versão inicial',
  });

  return NextResponse.json(data, { status: 201 });
}
