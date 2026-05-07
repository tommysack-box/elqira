// Contextual three-dot dropdown menu for bento grid cards
import { useEffect, useRef, useState } from 'react';

export interface CardMenuItem {
  key: string;
  label: string;
  icon: string;
  danger?: boolean;
  active?: boolean;
  activeIcon?: string;
  hidden?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

interface CardMenuProps {
  items: CardMenuItem[];
  /** Extra classes on the trigger button */
  className?: string;
}

export function CardMenu({ items, className = '' }: CardMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleItems = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`flex items-center justify-center w-7 h-7 rounded-lg text-[#777586] hover:text-[#191c1e] hover:bg-[#eceef0] transition-colors ${className}`}
      >
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[80] min-w-[170px] rounded-xl border border-[#c7c4d7]/20 bg-white shadow-lg py-1 overflow-hidden">
          {visibleItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={(e) => { item.onClick(e); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left
                ${item.danger
                  ? 'text-[#ba1a1a] hover:bg-[#ffdad6]/50'
                  : item.active
                    ? 'text-[#2a14b4] bg-[#e3dfff]/40 hover:bg-[#e3dfff]/70'
                    : 'text-[#191c1e] hover:bg-[#f2f4f6]'
                }`}
            >
              <span className="material-symbols-outlined text-[17px]" style={item.active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.active && item.activeIcon ? item.activeIcon : item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
