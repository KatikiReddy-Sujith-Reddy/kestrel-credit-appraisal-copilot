import React from 'react';

export type StatusVariant = 'valid' | 'warning' | 'error' | 'info' | 'draft' | 'success';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

export default function StatusBadge({ status, variant, className = '' }: StatusBadgeProps) {
  let v: StatusVariant = variant || 'draft';

  const s = status.toLowerCase();
  if (s.includes('valid') || s.includes('healthy') || s.includes('approved') || s.includes('complete') || s.includes('submitted')) {
    v = 'valid';
  } else if (s.includes('warn') || s.includes('pend') || s.includes('discrep') || s.includes('review') || s.includes('missing')) {
    v = 'warning';
  } else if (s.includes('fail') || s.includes('breach') || s.includes('error') || s.includes('return') || s.includes('invalid') || s.includes('expired')) {
    v = 'error';
  } else if (s.includes('queue') || s.includes('running') || s.includes('progress')) {
    v = 'info';
  }

  const styles: Record<StatusVariant, { bg: string; text: string; border: string }> = {
    valid: { bg: 'bg-[#DCFCE7]', text: 'text-[#15803D]', border: 'border-[#86EFAC]' },
    success: { bg: 'bg-[#DCFCE7]', text: 'text-[#15803D]', border: 'border-[#86EFAC]' },
    warning: { bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FDE68A]' },
    error: { bg: 'bg-[#FEE2E2]', text: 'text-[#B91C1C]', border: 'border-[#FCA5A5]' },
    info: { bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]', border: 'border-[#93C5FD]' },
    draft: { bg: 'bg-[#F1F5F9]', text: 'text-[#64748B]', border: 'border-[#E2E8F0]' },
  };

  const style = styles[v];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
      <span className="capitalize">{status.replace(/_/g, ' ')}</span>
    </span>
  );
}
