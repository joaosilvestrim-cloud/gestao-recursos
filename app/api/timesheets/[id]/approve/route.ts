import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from('timesheets')
    .update({
      status: body.approved ? 'approved' : 'rejected',
      reviewed_by: body.reviewed_by,
      reviewed_at: new Date().toISOString(),
      review_note: body.note ?? null,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
