import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const VALID_TYPES = ['billable', 'non_billable', 'absence', 'idle'];

function normalize(s: string) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const projectId = formData.get('project_id') as string;

  if (!file || !projectId) {
    return NextResponse.json({ error: 'file e project_id são obrigatórios' }, { status: 400 });
  }

  // Load all collaborators with current hourly cost for cross-reference
  const { data: collaborators } = await supabase
    .from('collaborators')
    .select('id, name, current_cost:collaborator_cost_history(hourly_cost, valid_until)')
    .is('deleted_at', null)
    .eq('active', true);

  // Build lookup map: normalized name → { id, hourly_cost }
  const costMap = new Map<string, { id: string; hourly_cost: number | null }>();
  for (const c of collaborators ?? []) {
    const currentCost = (c.current_cost as { hourly_cost: number; valid_until: string | null }[])
      ?.find(h => !h.valid_until)?.hourly_cost ?? null;
    costMap.set(normalize(c.name), { id: c.id, hourly_cost: currentCost });
  }

  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return NextResponse.json({ error: 'CSV vazio ou sem dados' }, { status: 400 });

  // Detect format: Clockify has "User" header, custom has "colaborador"
  const header = lines[0].toLowerCase();
  const isClockify = header.includes('user') && header.includes('duration');

  const { data: batch } = await supabase
    .from('import_batches')
    .insert({ project_id: projectId, filename: file.name, row_count: lines.length - 1, status: 'processing' })
    .select()
    .single();

  const errors: string[] = [];
  const warnings: string[] = [];
  const entries: object[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));

    let rawDate: string, collaboratorName: string, rawHours: string, rawType: string, description: string;

    if (isClockify) {
      // Clockify: User,Email,Client,Project,Task,Description,Billable,Start Date,...,Duration (decimal)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const get = (key: string) => cols[headers.findIndex(h => h.includes(key))] ?? '';
      rawDate = get('start date') || get('date');
      collaboratorName = get('user');
      rawHours = get('duration (decimal)') || get('hours');
      rawType = get('billable') === 'yes' || get('billable') === 'true' ? 'billable' : 'non_billable';
      description = get('description') || get('task');
    } else {
      // Custom format: data,colaborador,horas,custo_hora,tipo,descricao
      [rawDate, collaboratorName, rawHours, , rawType, description] = cols;
    }

    if (!rawDate || !collaboratorName) {
      errors.push(`Linha ${i + 1}: data e colaborador são obrigatórios`);
      continue;
    }

    const entryDate = new Date(rawDate);
    if (isNaN(entryDate.getTime())) {
      errors.push(`Linha ${i + 1}: data inválida "${rawDate}"`);
      continue;
    }

    const hours = rawHours ? parseFloat(rawHours) : null;
    if (hours !== null && isNaN(hours)) {
      errors.push(`Linha ${i + 1}: horas inválidas "${rawHours}"`);
      continue;
    }

    // Cross-reference collaborator to get registered cost
    const match = costMap.get(normalize(collaboratorName));
    if (!match) {
      warnings.push(`"${collaboratorName}" não encontrado nos colaboradores cadastrados — importado sem custo`);
    } else if (match.hourly_cost === null) {
      warnings.push(`"${collaboratorName}" não tem custo H/H definido — importe após cadastrar o custo`);
    }

    const entryType = VALID_TYPES.includes(rawType) ? rawType : 'billable';

    entries.push({
      project_id: projectId,
      import_batch_id: batch?.id,
      collaborator_id: match?.id ?? null,
      collaborator_name: collaboratorName,
      entry_date: entryDate.toISOString().split('T')[0],
      hours: hours,
      hourly_cost: match?.hourly_cost ?? null,
      entry_type: entryType,
      description: description ?? null,
      source: 'csv',
    });
  }

  let imported = 0;
  if (entries.length > 0) {
    const { error } = await supabase.from('cost_entries').insert(entries);
    if (!error) imported = entries.length;
    else errors.push(`Erro ao salvar: ${error.message}`);
  }

  await supabase.from('import_batches').update({
    imported_count: imported,
    error_count: errors.length,
    status: errors.length > 0 && imported === 0 ? 'error' : 'completed',
    error_log: [...errors, ...warnings].join('\n') || null,
  }).eq('id', batch?.id);

  return NextResponse.json({ ok: imported, errors, warnings });
}
