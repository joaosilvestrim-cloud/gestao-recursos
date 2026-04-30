import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();

  // Se mudando status para 'billed', registra data de faturamento
  if (body.status === 'billed' && !body.billed_at) {
    body.billed_at = new Date().toISOString().split('T')[0];
  }
  if (body.status === 'achieved' && !body.achieved_at) {
    body.achieved_at = new Date().toISOString().split('T')[0];
  }

  const { data, error } = await supabase.from('billing_milestones').update(body).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const { error } = await supabase.from('billing_milestones').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
