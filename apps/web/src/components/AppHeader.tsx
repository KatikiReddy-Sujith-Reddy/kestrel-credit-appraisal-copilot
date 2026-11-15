import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export default function AppHeader() {
  const { user, signOut, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowRoleMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const roleMeta: Record<string, { label: string; bg: string; text: string; dot: string; path: string; icon: string; desc: string }> = {
    rm: {
      label: 'Relationship Manager',
      bg: 'bg-emerald-700',
      text: 'text-white',
      dot: 'bg-emerald-400',
      path: '/rm',
      icon: 'contact_page',
      desc: 'Pipeline, checklist tracking, doc uploads & borrower follow-up drafts',
    },
    analyst: {
      label: 'Credit Analyst',
      bg: 'bg-blue-700',
      text: 'text-white',
      dot: 'bg-blue-400',
      path: '/analyst',
      icon: 'table_view',
      desc: '3-pane spreading, OCR bbox inspect, recon, ratios & grounded CAM',
    },
    credit_manager: {
      label: 'Credit Manager',
      bg: 'bg-slate-800',
      text: 'text-white',
      dot: 'bg-amber-400',
      path: '/credit',
      icon: 'fact_check',
      desc: 'Credit review queue, evidence inspect, threaded notes, LOS handoff',
    },
    cm: {
      label: 'Credit Manager',
      bg: 'bg-slate-800',
      text: 'text-white',
      dot: 'bg-amber-400',
      path: '/credit',
      icon: 'fact_check',
      desc: 'Credit review queue, evidence inspect, threaded notes, LOS handoff',
    },
    owner: {
      label: 'System Owner',
      bg: 'bg-purple-800',
      text: 'text-white',
      dot: 'bg-purple-400',
      path: '/owner',
      icon: 'admin_panel_settings',
      desc: 'Spend telemetry (USD), 8-step model wizard, prompt governance, audit export',
    },
  };

  const currentRole = roleMeta[user.activeRole] || {
    label: user.activeRole.toUpperCase(),
    bg: 'bg-slate-800',
    text: 'text-white',
    dot: 'bg-slate-300',
    path: `/${user.activeRole}`,
    icon: 'badge',
    desc: 'Authorized workspace',
  };

  // Dedicated role-specific nav links so each persona only sees relevant actions
  const getNavLinks = () => {
    switch (user.activeRole) {
      case 'rm':
        return [
          { label: 'Applications Pipeline', path: '/rm' },
        ];
      case 'analyst':
        return [
          { label: 'Analyst Spreading Queue', path: '/analyst' },
        ];
      case 'credit_manager':
      case 'cm':
        return [
          { label: 'Credit Review Queue', path: '/credit' },
        ];
      case 'owner':
      case 'risk_delegate':
        return [
          { label: 'Executive Governance Console', path: '/owner' },
        ];
      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

  const handleRoleSelect = async (roleKey: string) => {
    setShowRoleMenu(false);
    try {
      await switchRole(roleKey);
      const targetPath = roleMeta[roleKey]?.path || '/';
      navigate(targetPath);
    } catch (err) {
      console.error('Failed to switch role', err);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0f172a] text-white border-b border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Brand & Workspace Name */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(currentRole.path)}>
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-400 text-[20px]">shield_with_heart</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-sm text-white">KESTREL</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider">Copilot</span>
            </div>
            <span className="text-[11px] text-slate-400 truncate hidden sm:inline">SME Credit Underwriting</span>
          </div>
        </div>

        {/* Central Discreet Governance Badge */}
        <div className="hidden md:flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-full px-3 py-1 text-[11px] text-amber-300/90 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          <span>Synthetic Sandbox • Pilot (&le; $250,000) • Not a Credit Decision</span>
        </div>

        {/* Role-Specific Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Section: Role Switcher & User Profile */}
        <div className="flex items-center gap-3 relative" ref={menuRef}>
          {/* Active Role Selector Pill */}
          <button
            type="button"
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className={`h-8 px-3 rounded-full ${currentRole.bg} ${currentRole.text} text-xs font-semibold flex items-center gap-2 shadow-xs hover:opacity-95 transition-all border border-white/10`}
            title="Click to switch active role"
          >
            <span className={`w-2 h-2 rounded-full ${currentRole.dot}`}></span>
            <span className="truncate max-w-[130px]">{currentRole.label}</span>
            <span className="material-symbols-outlined text-[16px] text-white/80">
              {showRoleMenu ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Role Switcher Popover Menu */}
          {showRoleMenu && (
            <div className="absolute right-0 top-11 w-80 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Switch Active Role</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">RBAC</span>
              </div>

              <div className="py-1 flex flex-col gap-1">
                {[
                  { key: 'rm', ...roleMeta.rm },
                  { key: 'analyst', ...roleMeta.analyst },
                  { key: 'credit_manager', ...roleMeta.credit_manager },
                  { key: 'owner', ...roleMeta.owner },
                ].map((r) => {
                  const isCurrent = user.activeRole === r.key || (user.activeRole === 'cm' && r.key === 'credit_manager');
                  return (
                    <button
                      key={r.key}
                      onClick={() => handleRoleSelect(r.key)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs flex items-start gap-2.5 transition-colors ${
                        isCurrent ? 'bg-slate-100 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[18px] p-1 rounded-md ${r.bg} text-white shrink-0`}>
                        {r.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs">{r.label}</span>
                          {isCurrent && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{r.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Signed in as <strong className="text-slate-700">{user.username}</strong></span>
                <button
                  onClick={() => {
                    setShowRoleMenu(false);
                    navigate('/select-role');
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Manage Roles &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Profile Initials & Logout */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700/60">
            <div
              className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center text-[11px] font-bold"
              title={`${user.fullName} (${user.email})`}
            >
              {user.fullName.slice(0, 2).toUpperCase()}
            </div>
            <button
              onClick={() => {
                signOut().then(() => navigate('/sign-in'));
              }}
              className="text-slate-400 hover:text-white p-1 rounded-md text-xs transition-colors"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
