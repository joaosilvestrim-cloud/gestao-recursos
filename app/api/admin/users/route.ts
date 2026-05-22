import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET — list all users with profiles
export async function GET() {
  const supabase = await createClient();

  // Verify caller is director
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create/invite a new user
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, name, role, password } = await request.json();
  if (!email || !role || !password) {
    return NextResponse.json({ error: 'email, role e password são obrigatórios' }, { status: 400 });
  }

  const admin = getAdminClient();

  // Create user with role in metadata
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || email.split('@')[0], role },
  });

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });

  // Upsert profile (trigger should handle it, but belt+suspenders)
  await supabase.from('user_profiles').upsert({
    id: newUser.user.id,
    email,
    name: name || email.split('@')[0],
    role,
    active: true,
  });

  return NextResponse.json(newUser.user, { status: 201 });
}
