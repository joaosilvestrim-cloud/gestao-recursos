import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// PATCH — update role, name, active status
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const admin = getAdminClient();

  // Update user_metadata in auth if role/name changed
  if (body.role || body.name) {
    await admin.auth.admin.updateUserById(id, {
      user_metadata: {
        ...(body.role && { role: body.role }),
        ...(body.name && { name: body.name }),
      },
    });
  }

  // Update profile table
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// DELETE — deactivate user (soft) or fully delete
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Deactivate — keep profile but disable login
  const admin = getAdminClient();
  await admin.auth.admin.updateUserById(id, { ban_duration: '87600h' }); // 10 years

  await supabase
    .from('user_profiles')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  return new NextResponse(null, { status: 204 });
}
