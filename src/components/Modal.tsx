// Modal glassmorphic — dal design system Stitch
import React from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ title, onClose, children, size = 'md' }: ModalProps) {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#191c1e]/20 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full flex-col ${widths[size]} bg-white rounded-xl border border-white/20 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#c7c4d7]/20 px-6 py-4">
          <h2 className="text-base font-bold text-[#191c1e] tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="material-symbols-outlined text-[#777586] hover:text-[#191c1e] hover:bg-[#eceef0] p-1 rounded transition-colors text-sm"
          >
            close
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
