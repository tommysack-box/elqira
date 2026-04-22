// Reusable form field components — design system Stitch
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] font-bold text-[#777586] uppercase tracking-widest">
        {label}
        {hint && <span className="ml-1 normal-case font-normal text-[#c7c4d7]">({hint})</span>}
      </label>
      <input
        {...props}
        className={`px-3 py-2.5 text-sm bg-[#f2f4f6] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 transition-colors text-[#191c1e] placeholder:text-[#c7c4d7] ${
          error ? 'ring-2 ring-[#ba1a1a]/30' : ''
        } ${props.className ?? ''}`}
      />
      {error && <p className="text-xs text-[#ba1a1a]">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export function Textarea({ label, hint, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] font-bold text-[#777586] uppercase tracking-widest">
        {label}
        {hint && <span className="ml-1 normal-case font-normal text-[#c7c4d7]">({hint})</span>}
      </label>
      <textarea
        {...props}
        className={`px-3 py-2.5 text-sm bg-[#f2f4f6] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 transition-colors resize-none text-[#191c1e] placeholder:text-[#c7c4d7] ${props.className ?? ''}`}
      />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: React.ReactNode;
}

export function Select({ label, children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] font-bold text-[#777586] uppercase tracking-widest">{label}</label>
      <select
        {...props}
        className={`px-3 py-2.5 text-sm bg-[#f2f4f6] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 transition-colors text-[#191c1e] appearance-none ${props.className ?? ''}`}
      >
        {children}
      </select>
    </div>
  );
}
