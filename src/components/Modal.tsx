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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${widths[size]} mx-4 bg-white rounded-xl shadow-2xl border border-white/20`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c7c4d7]/20">
          <h2 className="text-base font-bold text-[#191c1e] tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="material-symbols-outlined text-[#777586] hover:text-[#191c1e] hover:bg-[#eceef0] p-1 rounded transition-colors text-sm"
          >
            close
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
