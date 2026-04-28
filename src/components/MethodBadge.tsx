// HTTP Method Badge — stile Stitch: monospace, rounded-sm (2px), palette tematica
import type { HttpMethod } from '../types';

interface MethodBadgeProps {
  method: HttpMethod;
  size?: 'xs' | 'sm' | 'md';
}

// Colori dal design system Stitch
const METHOD_STYLES: Record<HttpMethod, string> = {
  GET:     'bg-[#e3dfff] text-[#100069]',   // primary-fixed / on-primary-fixed
  POST:    'bg-[#89f5e7] text-[#00201d]',   // tertiary-fixed / on-tertiary-fixed
  PUT:     'bg-[#d5e3fc] text-[#0d1c2e]',   // secondary-fixed / on-secondary-fixed
  PATCH:   'bg-[#d5e3fc] text-[#3a485b]',   // secondary-fixed / on-secondary-fixed-variant
  DELETE:  'bg-[#ffdad6] text-[#93000a]',   // error-container / on-error-container
  HEAD:    'bg-[#e0e3e5] text-[#464554]',   // surface-container-highest / on-surface-variant
  OPTIONS: 'bg-[#eceef0] text-[#464554]',
};

export function MethodBadge({ method, size = 'md' }: MethodBadgeProps) {
  const sizeClass = size === 'xs'
    ? 'text-[9px] px-1 py-0 tracking-[0.18em]'
    : size === 'sm'
      ? 'text-[10px] px-1.5 py-0.5 tracking-widest'
      : 'text-xs px-2 py-0.5 tracking-widest';
  return (
    <span
      className={`shrink-0 font-mono font-semibold uppercase ${sizeClass} ${METHOD_STYLES[method]}`}
      style={{ borderRadius: 2 }}
    >
      {method}
    </span>
  );
}
