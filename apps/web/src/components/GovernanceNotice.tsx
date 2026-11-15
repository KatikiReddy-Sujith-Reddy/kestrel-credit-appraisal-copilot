import React from 'react';

export default function GovernanceNotice({ contextText }: { contextText?: string }) {
  return (
    <div className="w-full bg-slate-50/80 border border-slate-200/80 px-3.5 py-2 rounded-lg flex items-center justify-between gap-3 text-xs text-slate-700">
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-teal-700 text-[18px] shrink-0">shield</span>
        <div className="truncate">
          <strong className="text-slate-900 font-semibold">Human-in-the-Loop: </strong>
          <span className="text-slate-600">
            {contextText || 'The copilot synthesizes evidence. Formal sanction is executed manually in the production Loan Origination System (LOS).'}
          </span>
        </div>
      </div>
      <span className="bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 font-mono">
        Not A Credit Decision
      </span>
    </div>
  );
}
