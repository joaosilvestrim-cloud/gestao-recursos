import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  // Support lookup by slug OR uuid
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  let query = supabase
    .from('wiki_articles')
    .select('*, category:wiki_categories(id, name, icon, slug)')
    .is('deleted_at', null);

  query = isUUID ? query.eq('id', id) : query.eq('slug', id);

  const { data, error } = await query.single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Increment views
  await supabase.from('wiki_articles').update({ views: (data.views ?? 0) + 1 }).eq('id', data.id);

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();

  body.updated_at = new Date().toISOString();

  // Get current version count
  const { count } = await supabase
    .from('wiki_article_versions')
    .select('*', { count: 'exact', head: true })
    .eq('article_id', id);

  const { data, error } = await supabase
    .from('wiki_articles')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Save new version snapshot
  if (body.content !== undefined) {
    await supabase.from('wiki_article_versions').insert({
      article_id: id,
      content: body.content,
      title: data.title,
      version_number: (count ?? 0) + 1,
      changed_by: body.changed_by ?? 'Admin',
      change_summary: body.change_summary ?? null,
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const { error } = await supabase
    .from('wiki_articles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
