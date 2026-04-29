import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const collaboratorId = searchParams.get('collaborator_id');
  const projectId = searchParams.get('project_id');
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabase
    .from('timesheets')
    .select('*, collaborator:collaborators(id, name), project:projects(id, name), phase:project_phases(id, name)')
    .is('deleted_at', null)
    .order('worked_date', { ascending: false });

  if (collaboratorId) query = query.eq('collaborator_id', collaboratorId);
  if (projectId) query = query.eq('project_id', projectId);
  if (status) query = query.eq('status', status);
  if (from) query = query.gte('worked_date', from);
  if (to) query = query.lte('worked_date', to);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('timesheets')
    .insert({ ...body, status: 'pending' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
