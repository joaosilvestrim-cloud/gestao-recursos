import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const skill = searchParams.get('skill');

  let query = supabase
    .from('collaborators')
    .select('*, skills:collaborator_skills(skill:skills(id, name), level), current_cost:collaborator_cost_history(hourly_cost, valid_from, valid_until)')
    .is('deleted_at', null)
    .eq('active', true)
    .order('name');

  if (skill) {
    query = query.eq('collaborator_skills.skills.name', skill);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { hourly_cost, ...collaboratorData } = body;

  const { data: collaborator, error } = await supabase
    .from('collaborators')
    .insert(collaboratorData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (hourly_cost) {
    await supabase.from('collaborator_cost_history').insert({
      collaborator_id: collaborator.id,
      hourly_cost,
      valid_from: new Date().toISOString().split('T')[0],
    });
  }

  return NextResponse.json(collaborator, { status: 201 });
}
