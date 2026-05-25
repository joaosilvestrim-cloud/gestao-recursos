import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function requireFinance() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!['director', 'finance'].includes(user.user_metadata?.role)) return null;
  return supabase;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await requireFinance();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();

  const allowed = ['description','amount','due_date','paid_date','status','category','party','project_id','notes','recurrence','type'];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  // When marking as paid and no paid_date provided, default to today
  if (update.status === 'paid' && !update.paid_date) {
    update.paid_date = new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await supabase
    .from('financial_entries')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await requireFinance();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const { error } = await supabase
    .from('financial_entries')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
