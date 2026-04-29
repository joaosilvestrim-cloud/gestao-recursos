import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; phaseId: string }> }) {
  const supabase = await createClient();
  const { phaseId } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from('project_phases')
    .update(body)
    .eq('id', phaseId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; phaseId: string }> }) {
  const supabase = await createClient();
  const { phaseId } = await params;

  const { error } = await supabase
    .from('project_phases')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', phaseId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
