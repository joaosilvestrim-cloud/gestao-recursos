import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from('collaborators')
    .select('*, skills:collaborator_skills(skill:skills(id, name), level), cost_history:collaborator_cost_history(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();
  const { hourly_cost, ...collaboratorData } = body;

  const { data, error } = await supabase
    .from('collaborators')
    .update(collaboratorData)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Novo custo H/H: fecha o anterior e abre novo
  if (hourly_cost !== undefined) {
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('collaborator_cost_history')
      .update({ valid_until: today })
      .eq('collaborator_id', id)
      .is('valid_until', null);

    await supabase.from('collaborator_cost_history').insert({
      collaborator_id: id,
      hourly_cost,
      valid_from: today,
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { error } = await supabase
    .from('collaborators')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
