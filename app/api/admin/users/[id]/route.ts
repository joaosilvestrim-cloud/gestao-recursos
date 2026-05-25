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

async function requireDirector() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'director') return null;
  return { supabase, user };
}

// PATCH — update role/name, reactivate, or reset password
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDirector();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { supabase } = auth;
  const { id } = await params;
  const body = await request.json();
  const admin = getAdminClient();

  // Special action: reactivate
  if (body.action === 'reactivate') {
    await admin.auth.admin.updateUserById(id, { ban_duration: 'none' });
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  // Special action: reset password (send email)
  if (body.action === 'reset_password') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', id)
      .single();
    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Use admin to generate a password reset link
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
    });
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });
    return NextResponse.json({ link: linkData.properties?.action_link ?? null });
  }

  // Special action: set new password directly
  if (body.action === 'set_password') {
    if (!body.password || body.password.length < 8) {
      return NextResponse.json({ error: 'Senha precisa ter ao menos 8 caracteres' }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(id, { password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Default: update role and/or name
  const updateMeta: Record<string, string> = {};
  if (body.role) updateMeta.role = body.role;
  if (body.name) updateMeta.name = body.name;

  if (Object.keys(updateMeta).length > 0) {
    await admin.auth.admin.updateUserById(id, { user_metadata: updateMeta });
  }

  const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.role) profileUpdate.role = body.role;
  if (body.name) profileUpdate.name = body.name;

  const { data, error } = await supabase
    .from('user_profiles')
    .update(profileUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// DELETE — deactivate (ban) user, keep data
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDirector();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { supabase } = auth;
  const { id } = await params;
  const admin = getAdminClient();

  await admin.auth.admin.updateUserById(id, { ban_duration: '87600h' });
  await supabase
    .from('user_profiles')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  return new NextResponse(null, { status: 204 });
}
