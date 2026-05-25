import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function requireFinance() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const role = user.user_metadata?.role;
  if (!['director', 'finance'].includes(role)) return null;
  return supabase;
}

export async function GET(request: NextRequest) {
  const supabase = await requireFinance();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');       // 'receivable' | 'payable' | null (all)
  const status = searchParams.get('status');   // 'pending' | 'paid' | 'overdue' | 'cancelled'
  const from = searchParams.get('from');       // date ISO
  const to = searchParams.get('to');           // date ISO

  let query = supabase
    .from('financial_entries')
    .select('*, project:projects(id,name)')
    .order('due_date', { ascending: true });

  if (type) query = query.eq('type', type);
  if (status === 'overdue') {
    query = query.eq('status', 'pending').lt('due_date', new Date().toISOString().slice(0, 10));
  } else if (status) {
    query = query.eq('status', status);
  } else {
    query = query.neq('status', 'cancelled');
  }
  if (from) query = query.gte('due_date', from);
  if (to)   query = query.lte('due_date', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Enrich with effective_status
  const today = new Date().toISOString().slice(0, 10);
  const enriched = (data ?? []).map(e => ({
    ...e,
    effective_status: e.status === 'pending' && e.due_date < today ? 'overdue' : e.status,
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const supabase = await requireFinance();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { type, description, amount, due_date, category, party, project_id, notes, recurrence } = body;

  if (!type || !description || !amount || !due_date) {
    return NextResponse.json({ error: 'type, description, amount e due_date são obrigatórios' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('financial_entries')
    .insert({
      type, description, amount: Number(amount), due_date, status: 'pending',
      category: category || null, party: party || null,
      project_id: project_id || null, notes: notes || null,
      recurrence: recurrence || 'none',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
