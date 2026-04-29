import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const limit = parseInt(searchParams.get('limit') ?? '50');

  let query = supabase
    .from('cost_entries')
    .select('*, project:projects(id, name), phase:project_phases(id, name)')
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .limit(limit);

  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('cost_entries')
    .insert({ ...body, source: 'manual' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
