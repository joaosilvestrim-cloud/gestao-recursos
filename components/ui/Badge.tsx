const variants: Record<string, string> = {
  active:    'bg-green-500/15 text-green-400 border border-green-500/30',
  paused:    'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  completed: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border border-red-500/30',
  pending:   'bg-gray-500/15 text-gray-400 border border-gray-500/30',
  approved:  'bg-green-500/15 text-green-400 border border-green-500/30',
  rejected:  'bg-red-500/15 text-red-400 border border-red-500/30',
  billable:     'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  non_billable: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  absence:      'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  idle:         'bg-gray-500/15 text-gray-400 border border-gray-500/30',
};

const labels: Record<string, string> = {
  active: 'Ativo', paused: 'Pausado', completed: 'Concluído', cancelled: 'Cancelado',
  pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado',
  billable: 'Faturável', non_billable: 'Não Faturável', absence: 'Ausência', idle: 'Ocioso',
  junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior', especialista: 'Especialista', lider: 'Líder',
};

export default function Badge({ value }: { value: string }) {
  const cls = variants[value] ?? 'bg-gray-500/15 text-gray-400 border border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {labels[value] ?? value}
    </span>
  );
}
