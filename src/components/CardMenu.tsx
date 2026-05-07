// Contextual three-dot dropdown menu for bento grid cards
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const visibleItems = items.filter((item) => !item.hidden);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const estimatedMenuHeight = visibleItems.length * 41 + 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const shouldOpenUpward = spaceBelow < estimatedMenuHeight + 8 && rect.top > spaceBelow;

      setMenuPosition(
        shouldOpenUpward
          ? {
              bottom: window.innerHeight - rect.top + 4,
              right: window.innerWidth - rect.right,
            }
          : {
              top: rect.bottom + 4,
              right: window.innerWidth - rect.right,
            }
      );
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, visibleItems.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        if (menuRef.current?.contains(e.target as Node)) return;
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
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`flex items-center justify-center w-7 h-7 rounded-lg text-[#777586] hover:text-[#191c1e] hover:bg-[#eceef0] transition-colors ${className}`}
      >
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>

      {open && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[120] min-w-[170px] rounded-xl border border-[#c7c4d7]/20 bg-white shadow-lg py-1 overflow-hidden"
          style={{ top: menuPosition.top, bottom: menuPosition.bottom, right: menuPosition.right }}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
}
