import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Colunas esperadas: data, colaborador, horas, custo_hora, tipo, descricao
const VALID_TYPES = ['billable', 'non_billable', 'absence', 'idle'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const projectId = formData.get('project_id') as string;

  if (!file || !projectId) {
    return NextResponse.json({ error: 'file e project_id são obrigatórios' }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return NextResponse.json({ error: 'CSV vazio ou sem dados' }, { status: 400 });

  // Criar batch
  const { data: batch } = await supabase
    .from('import_batches')
    .insert({ project_id: projectId, filename: file.name, row_count: lines.length - 1, status: 'processing' })
    .select()
    .single();

  const errors: string[] = [];
  const entries: object[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const [rawDate, collaborator, rawHours, rawCost, rawType, description] = cols;

    if (!rawDate || !collaborator) {
      errors.push(`Linha ${i + 1}: data e colaborador são obrigatórios`);
      continue;
    }

    const entryDate = new Date(rawDate);
    if (isNaN(entryDate.getTime())) {
      errors.push(`Linha ${i + 1}: data inválida "${rawDate}"`);
      continue;
    }

    const hours = rawHours ? parseFloat(rawHours) : null;
    const hourlyCost = rawCost ? parseFloat(rawCost) : null;
    const entryType = VALID_TYPES.includes(rawType) ? rawType : 'billable';

    entries.push({
      project_id: projectId,
      import_batch_id: batch?.id,
      collaborator_name: collaborator,
      entry_date: entryDate.toISOString().split('T')[0],
      hours: isNaN(hours as number) ? null : hours,
      hourly_cost: isNaN(hourlyCost as number) ? null : hourlyCost,
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
    error_log: errors.join('\n') || null,
  }).eq('id', batch?.id);

  return NextResponse.json({ ok: imported, errors });
}
