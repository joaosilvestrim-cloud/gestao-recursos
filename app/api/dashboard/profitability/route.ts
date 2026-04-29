import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level') ?? 'project';

  const viewMap: Record<string, string> = {
    project: 'v_project_pl',
    client:  'v_client_pl',
    group:   'v_group_pl',
  };

  const view = viewMap[level] ?? 'v_project_pl';
  const { data, error } = await supabase.from(view).select('*');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
