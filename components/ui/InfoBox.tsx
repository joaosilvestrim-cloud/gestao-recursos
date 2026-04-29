interface Props {
  icon?: string;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'warning' | 'tip';
}

export default function InfoBox({ icon, title, children, variant = 'default' }: Props) {
  const styles = {
    default: 'bg-gray-800/60 border-white/8 text-gray-400',
    warning: 'bg-yellow-500/5 border-yellow-500/20 text-yellow-300',
    tip:     'bg-cyan-500/5 border-cyan-500/20 text-cyan-300',
  };
  return (
    <div className={`rounded-xl border p-4 ${styles[variant]}`}>
      <p className="text-xs font-semibold mb-1.5">
        {icon && <span className="mr-1.5">{icon}</span>}
        {title}
      </p>
      <div className="text-xs leading-relaxed space-y-1">{children}</div>
    </div>
  );
}
