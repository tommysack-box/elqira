const TAG_COLORS: Record<string, string> = {
  GET: 'bg-[#e3dfff] text-[#100069]',
  POST: 'bg-[#d5e3fc] text-[#0d1c2e]',
  PUT: 'bg-[#89f5e7] text-[#00201d]',
  PATCH: 'bg-[#6bd8cb] text-[#005049]',
  DELETE: 'bg-[#ffdad6] text-[#93000a]',
};

interface EntityTagProps {
  tag?: string;
  fallback: string;
  className?: string;
}

export function EntityTag({ tag, fallback, className = '' }: EntityTagProps) {
  const value = tag?.trim() || fallback;
  const cls = TAG_COLORS[value.toUpperCase()] ?? 'bg-[#e0e3e5] text-[#464554]';

  return (
    <span
      className={`font-mono text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-widest uppercase ${cls} ${className}`.trim()}
    >
      {value}
    </span>
  );
}
