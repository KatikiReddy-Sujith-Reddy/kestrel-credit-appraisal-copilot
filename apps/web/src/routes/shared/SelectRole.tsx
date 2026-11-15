import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';

export default function SelectRole() {
  const navigate = useNavigate();
  const { user, switchRole } = useAuth();

  if (!user) {
    navigate('/sign-in');
    return null;
  }

  const roleMeta: Record<string, { label: string; desc: string; icon: string; border: string; bg: string; text: string; path: string }> = {
    rm: {
      label: 'Relationship Manager',
      desc: 'Pipeline & checklist hub, document intake, follow-ups',
      icon: 'badge',
      border: 'border-[#ccfbf1]',
      bg: 'bg-[#f0fdfa]',
      text: 'text-[#0f766e]',
      path: '/rm',
    },
    analyst: {
      label: 'Credit Analyst',
      desc: 'Extraction workbench, reconciliation, ratios, CAM generation',
      icon: 'fact_check',
      border: 'border-[#bfdbfe]',
      bg: 'bg-[#eff6ff]',
      text: 'text-[#1d4ed8]',
      path: '/analyst',
    },
    credit_manager: {
      label: 'Credit Manager',
      desc: 'CAM review, verification audit trail, return or complete review',
      icon: 'rate_review',
      border: 'border-[#cbd5e1]',
      bg: 'bg-[#f1f5f9]',
      text: 'text-[#1e293b]',
      path: '/credit',
    },
    cm: {
      label: 'Credit Manager',
      desc: 'CAM review, verification audit trail, return or complete review',
      icon: 'rate_review',
      border: 'border-[#cbd5e1]',
      bg: 'bg-[#f1f5f9]',
      text: 'text-[#1e293b]',
      path: '/credit',
    },
    owner: {
      label: 'System Owner & Governance',
      desc: 'Model registry, prompt editor, evaluations, audit & telemetry',
      icon: 'shield',
      border: 'border-[#e9d5ff]',
      bg: 'bg-[#faf5ff]',
      text: 'text-[#6d28d9]',
      path: '/owner',
    },
  };

  const handleSelect = async (role: string) => {
    await switchRole(role);
    const meta = roleMeta[role];
    if (meta) {
      navigate(meta.path);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
      <div className="w-full bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm">
              {user.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">{user.fullName}</h2>
              <p className="text-xs text-on-surface-variant font-mono">{user.email}</p>
            </div>
          </div>
          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-amber-300">
            Simulated Role Selector
          </span>
        </div>

        <p className="text-xs text-on-surface-variant">
          Select an active operational viewpoint from your assigned institutional authorizations:
        </p>

        <div className="flex flex-col gap-2.5">
          {user.assignedRoles.map((role) => {
            const meta = roleMeta[role] || {
              label: role.toUpperCase(),
              desc: 'Standard assigned capability',
              icon: 'person',
              border: 'border-slate-200',
              bg: 'bg-slate-50',
              text: 'text-slate-800',
              path: `/${role}`,
            };
            const isActive = user.activeRole === role;

            return (
              <button
                key={role}
                type="button"
                onClick={() => handleSelect(role)}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${meta.bg} ${meta.border} ${
                  isActive ? 'ring-2 ring-primary ring-offset-1 shadow-sm' : 'hover:opacity-90'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-xs ${meta.text}`}>
                  <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${meta.text}`}>{meta.label}</span>
                    {isActive && (
                      <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">{meta.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
