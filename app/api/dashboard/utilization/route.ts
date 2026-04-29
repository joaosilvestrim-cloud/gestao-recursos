import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const weeks = parseInt(searchParams.get('weeks') ?? '4');

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from('v_weekly_utilization')
    .select('*')
    .gte('week_start', fromDate.toISOString().split('T')[0])
    .order('week_start', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
