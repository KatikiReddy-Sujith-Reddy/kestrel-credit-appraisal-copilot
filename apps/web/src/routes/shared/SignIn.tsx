import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiSignIn, apiOwnerSignIn, apiVerifyMfa } from '../../api/auth';
import { useAuth } from '../../state/AuthContext';

export default function SignIn() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'user' | 'owner'>('user');
  const [identifier, setIdentifier] = useState('priya.nair@kestrel-synthetic.bank');
  const [password, setPassword] = useState('Kestrel@RM2026!');
  const [hardwareToken, setHardwareToken] = useState('FIDO2_SECURE_TOKEN_SG_88301');
  const [ownerEmail, setOwnerEmail] = useState('sanjay.gupta@kestrel-synthetic.bank');

  // MFA state
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [mfaDigits, setMfaDigits] = useState(['7', '4', '2', '9', '1', '8']);
  const [simulatedCode, setSimulatedCode] = useState('742918');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('rm');

  const handleUserSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await apiSignIn(identifier, password);
      setChallengeId(res.challengeId);
      setSimulatedCode(res.simulatedMfaCode);
      if (res.user.assignedRoles.length > 0) {
        setSelectedRole(res.user.assignedRoles[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await apiOwnerSignIn(hardwareToken, ownerEmail);
      setChallengeId(res.challengeId);
      setSimulatedCode(res.simulatedMfaCode);
      setSelectedRole('owner');
    } catch (err: any) {
      setErrorMsg(err.message || 'Owner authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!challengeId) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      const code = mfaDigits.join('');
      const res = await apiVerifyMfa(challengeId, code, selectedRole);
      setUser(res.user);

      // Route based on active role
      if (res.user.activeRole === 'rm') {
        navigate('/rm');
      } else if (res.user.activeRole === 'analyst') {
        navigate('/analyst');
      } else if (res.user.activeRole === 'credit_manager' || res.user.activeRole === 'cm') {
        navigate('/credit');
      } else if (res.user.activeRole === 'owner') {
        navigate('/owner');
      } else {
        navigate('/select-role');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'MFA Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (id: string, pwd: string, role: string) => {
    setErrorMsg(null);
    if (role === 'owner') {
      setActiveTab('owner');
      setOwnerEmail(id);
      setHardwareToken('FIDO2_SECURE_TOKEN_SG_88301');
      setSelectedRole('owner');
    } else {
      setActiveTab('user');
      setIdentifier(id);
      setPassword(pwd);
      setSelectedRole(role);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full">
      {/* 1. Header & Institutional Brand Mark */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-3">
          <span className="material-symbols-outlined text-on-primary text-[32px]">domain_verification</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">Kestrel Credit Appraisal Copilot</h1>
        <p className="text-sm text-on-surface-variant mt-1">SME Working Capital Underwriting Platform (Pilot Cohort &lt; $250,000)</p>
      </div>

      {/* 2. Human Governance Disclaimer Strip */}
      <div className="w-full bg-[#f2f3ff] border border-[#cbd5e1] p-3 rounded-xl flex items-start gap-3 shadow-sm mb-5">
        <span className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">shield_person</span>
        <p className="text-xs text-on-surface leading-relaxed">
          <strong className="font-semibold text-primary">Copilot advises and extracts.</strong> Credit decisions are made exclusively by authorized human underwriters.
        </p>
      </div>

      {/* 3. Main Auth Card */}
      <div className="w-full bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-sm flex flex-col gap-4">
        {/* Dual Sign-in Path Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-[#f2f3ff] p-1.5 rounded-xl">
          <button
            type="button"
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'user' ? 'bg-secondary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            onClick={() => {
              setActiveTab('user');
              setChallengeId(null);
            }}
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            User Sign-in
          </button>
          <button
            type="button"
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'owner' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            onClick={() => {
              setActiveTab('owner');
              setChallengeId(null);
            }}
          >
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            Owner Sign-in
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: User Form */}
        {activeTab === 'user' && !challengeId && (
          <form onSubmit={handleUserSignIn} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Institutional Access (RM / Analyst / CM)</span>
              <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full text-[11px] font-semibold">Standard RBAC</span>
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">Corporate Email or Username</label>
              <div className="relative flex items-center bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2">
                <span className="material-symbols-outlined text-[#64748b] text-[18px] mr-2">alternate_email</span>
                <input
                  type="text"
                  className="bg-transparent text-sm text-on-surface w-full focus:outline-none"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. priya.nair@kestrel-synthetic.bank or rm.demo"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">Credential Key (Password)</label>
              <div className="relative flex items-center bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2">
                <span className="material-symbols-outlined text-[#64748b] text-[18px] mr-2">lock</span>
                <input
                  type="password"
                  className="bg-transparent text-sm text-on-surface w-full focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary hover:bg-[#005a54] text-white py-2.5 rounded-lg text-sm font-semibold shadow-sm flex items-center justify-center gap-2 mt-2 transition-colors disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Authenticate Workspace'}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>
        )}

        {/* Step 1: Owner Form */}
        {activeTab === 'owner' && !challengeId && (
          <form onSubmit={handleOwnerSignIn} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Administrative Access</span>
              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-[11px] font-semibold">Tier-0 Privileged</span>
            </div>

            <div className="bg-[#eaedff] p-3 rounded-lg flex items-center gap-2.5 border border-[#c5c6ce]">
              <span className="material-symbols-outlined text-primary text-[24px]">admin_panel_settings</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">Sanjay Gupta (synthetic)</span>
                <span className="text-[11px] text-on-surface-variant">System & Model Governance Administrator</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">Hardware FIDO Key / PIV Yubikey</label>
              <div className="relative flex items-center bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2">
                <span className="material-symbols-outlined text-primary text-[18px] mr-2">key</span>
                <input
                  type="text"
                  className="bg-transparent text-sm text-on-surface w-full focus:outline-none font-mono"
                  value={hardwareToken}
                  onChange={(e) => setHardwareToken(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-[#14213d] text-white py-2.5 rounded-lg text-sm font-semibold shadow-sm flex items-center justify-center gap-2 mt-2 transition-colors disabled:opacity-50"
            >
              <span>{loading ? 'Verifying Hardware Token...' : 'Sign In as System Owner'}</span>
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </button>
          </form>
        )}

        {/* Step 2: Simulated 2FA Token Verification */}
        {challengeId && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">security</span>
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Institutional 2FA Token</span>
              </div>
              <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Simulated MFA
              </span>
            </div>

            <div className="bg-[#f0fdfa] border border-[#ccfbf1] p-3 rounded-lg text-xs text-[#0f766e] flex items-center justify-between">
              <span>Simulated Passcode:</span>
              <span className="font-mono font-bold tracking-widest text-sm bg-white px-2 py-0.5 rounded border border-[#ccfbf1]">
                {simulatedCode}
              </span>
            </div>

            {/* 6 Digit Inputs */}
            <div className="grid grid-cols-6 gap-2 text-center">
              {mfaDigits.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  className="w-full h-11 text-center font-bold text-lg bg-[#f8fafc] border border-[#cbd5e1] rounded-lg focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none text-on-surface"
                  value={digit}
                  onChange={(e) => {
                    const newDigits = [...mfaDigits];
                    newDigits[idx] = e.target.value.slice(-1);
                    setMfaDigits(newDigits);
                  }}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChallengeId(null)}
                className="w-1/3 border border-[#cbd5e1] text-xs font-semibold py-2.5 rounded-lg hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleVerifyMfa}
                disabled={loading}
                className="flex-1 bg-secondary hover:bg-[#005a54] text-white py-2.5 rounded-lg text-sm font-semibold shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? 'Validating Token...' : 'Complete Sign-In'}</span>
                <span className="material-symbols-outlined text-[18px]">verified</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Inactivity Notice */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] p-2.5 rounded-lg flex items-center justify-between text-xs text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">timer</span>
            <span>Expires after 15m inactivity</span>
          </div>
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Session Protected</span>
        </div>
      </div>

      {/* 5. Quick Fill Demo Personas Panel */}
      <div className="w-full bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-sm mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Synthetic Demo Personas</span>
          <span className="text-[11px] text-on-surface-variant">Click to populate</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="p-2.5 rounded-lg border border-[#ccfbf1] bg-[#f0fdfa] hover:bg-[#e6faf7] text-left transition-colors flex flex-col"
            onClick={() => fillDemo('priya.nair@kestrel-synthetic.bank', 'Kestrel@RM2026!', 'rm')}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-[#0f766e]">Priya Nair</span>
              <span className="text-[10px] font-bold bg-[#ccfbf1] text-[#0f766e] px-1.5 py-0.5 rounded">RM</span>
            </div>
            <span className="text-[11px] text-[#0f766e]/80 mt-0.5">Relationship Manager</span>
          </button>

          <button
            type="button"
            className="p-2.5 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] hover:bg-[#e0efff] text-left transition-colors flex flex-col"
            onClick={() => fillDemo('arjun.menon@kestrel-synthetic.bank', 'Kestrel@Analyst2026!', 'analyst')}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-[#1d4ed8]">Arjun Menon</span>
              <span className="text-[10px] font-bold bg-[#bfdbfe] text-[#1d4ed8] px-1.5 py-0.5 rounded">Analyst</span>
            </div>
            <span className="text-[11px] text-[#1d4ed8]/80 mt-0.5">Credit Analyst</span>
          </button>

          <button
            type="button"
            className="p-2.5 rounded-lg border border-[#cbd5e1] bg-[#f1f5f9] hover:bg-[#e2e8f0] text-left transition-colors flex flex-col"
            onClick={() => fillDemo('kavitha.rao@kestrel-synthetic.bank', 'Kestrel@CM2026!', 'credit_manager')}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-[#1e293b]">Kavitha Rao</span>
              <span className="text-[10px] font-bold bg-[#cbd5e1] text-[#1e293b] px-1.5 py-0.5 rounded">CM</span>
            </div>
            <span className="text-[11px] text-[#1e293b]/80 mt-0.5">Credit Manager</span>
          </button>

          <button
            type="button"
            className="p-2.5 rounded-lg border border-[#e9d5ff] bg-[#faf5ff] hover:bg-[#f3e8ff] text-left transition-colors flex flex-col"
            onClick={() => fillDemo('sanjay.gupta@kestrel-synthetic.bank', 'Kestrel@Owner2026!', 'owner')}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-[#6d28d9]">Sanjay Gupta</span>
              <span className="text-[10px] font-bold bg-[#e9d5ff] text-[#6d28d9] px-1.5 py-0.5 rounded">Owner</span>
            </div>
            <span className="text-[11px] text-[#6d28d9]/80 mt-0.5">System Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
}
