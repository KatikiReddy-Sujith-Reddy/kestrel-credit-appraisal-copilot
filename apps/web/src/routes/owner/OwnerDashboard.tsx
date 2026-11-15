import React, { useState, useEffect } from 'react';
import AppHeader from '../../components/AppHeader';
import GovernanceNotice from '../../components/GovernanceNotice';
import StatusBadge from '../../components/StatusBadge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'agents' | 'models' | 'prompts' | 'evals' | 'audit' | 'users'>('telemetry');

  // Telemetry data
  const [costsSummary, setCostsSummary] = useState<any>(null);
  const [tokensSummary, setTokensSummary] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [llmCalls, setLlmCalls] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [evalMetrics, setEvalMetrics] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Inspector modal
  const [inspectCall, setInspectCall] = useState<any>(null);

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardTargetModel, setWizardTargetModel] = useState('gemini-2.5-flash');
  const [wizardReason, setWizardReason] = useState('Production upgrade to improve structured extraction token efficiency');
  const [wizardReqId, setWizardReqId] = useState<string | null>(null);
  const [wizardProbe, setWizardProbe] = useState<any>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Prompt Editor state
  const [selectedAgent, setSelectedAgent] = useState('bank-extractor');
  const [promptVersions, setPromptVersions] = useState<any[]>([]);
  const [newPromptBody, setNewPromptBody] = useState('');
  const [newChangeNote, setNewChangeNote] = useState('');
  const [promptRiskClass, setPromptRiskClass] = useState<'credit_relevant' | 'operational'>('credit_relevant');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptSuccess, setPromptSuccess] = useState<string | null>(null);
  const [showCreatePromptModal, setShowCreatePromptModal] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null);
  const [probeLoading, setProbeLoading] = useState<string | null>(null);
  const [probeResults, setProbeResults] = useState<Record<string, any>>({});
  const [approvingPrompt, setApprovingPrompt] = useState<string | null>(null);
  const [rollingBackPrompt, setRollingBackPrompt] = useState<string | null>(null);

  // Observability & Traces state (Feature E)
  const [tracesData, setTracesData] = useState<any[]>([]);
  const [latencyData, setLatencyData] = useState<any>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string>('trc_wf_extraction_1015');
  const [selectedSpan, setSelectedSpan] = useState<any>(null);

  // Export audit state
  const [exportedHash, setExportedHash] = useState<string | null>(null);

  useEffect(() => {
    loadOwnerData();
  }, [activeTab, selectedAgent]);

  const loadOwnerData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      if (activeTab === 'telemetry') {
        const cRes = await fetch('/api/v1/costs/summary', { headers });
        setCostsSummary(await cRes.json());
        const tRes = await fetch('/api/v1/tokens/summary', { headers });
        setTokensSummary(await tRes.json());
        const ltcRes = await fetch('/api/v1/observability/latency', { headers });
        setLatencyData(await ltcRes.json());
        const trcRes = await fetch('/api/v1/observability/traces', { headers });
        const trcJson = await trcRes.json();
        setTracesData(trcJson.traces || []);
        if (trcJson.traces?.length > 0 && !selectedTraceId) {
          setSelectedTraceId(trcJson.traces[0].traceId);
        }
      } else if (activeTab === 'agents') {
        const aRes = await fetch('/api/v1/agents', { headers });
        const aData = await aRes.json();
        setAgents(aData.agents || []);
        const lRes = await fetch('/api/v1/llm-calls', { headers });
        const lData = await lRes.json();
        setLlmCalls(lData.calls || []);
      } else if (activeTab === 'models') {
        const mRes = await fetch('/api/v1/model-registry', { headers });
        const mData = await mRes.json();
        setModels(mData.models || []);
      } else if (activeTab === 'prompts') {
        const pRes = await fetch(`/api/v1/prompts/${selectedAgent}/versions`, { headers });
        const pData = await pRes.json();
        setPromptVersions(pData.versions || []);
      } else if (activeTab === 'evals') {
        const eRes = await fetch('/api/v1/evaluations/metrics', { headers });
        const eData = await eRes.json();
        setEvalMetrics(eData.metrics || []);
      } else if (activeTab === 'audit') {
        const auRes = await fetch('/api/v1/audit-events', { headers });
        const auData = await auRes.json();
        setAuditEvents(auData.events || []);
      } else if (activeTab === 'users') {
        const uRes = await fetch('/api/v1/admin/users', { headers });
        const uData = await uRes.json();
        setUsers(uData.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Prompt Governance Handlers
  const handleSavePromptVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptBody.trim() || !newChangeNote.trim()) return;
    setSavingPrompt(true);
    setPromptError(null);
    setPromptSuccess(null);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/prompts/${selectedAgent}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          body: newPromptBody,
          changeNote: newChangeNote,
          riskClass: promptRiskClass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromptError(data.message || 'Failed to create prompt version');
      } else {
        setPromptSuccess(`Proposed new version ${data.versionId} (status: pending_approval). Two-person review required before publication.`);
        setShowCreatePromptModal(false);
        setNewChangeNote('');
        await loadOwnerData();
      }
    } catch (err: any) {
      setPromptError(err.message);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleApprovePromptVersion = async (pv: any, asRole: 'self' | 'secondary_owner' | 'risk_delegate' = 'self') => {
    setApprovingPrompt(pv.id);
    setPromptError(null);
    setPromptSuccess(null);
    try {
      let authToken = localStorage.getItem('kestrel_token');

      // If simulating a secondary approver or risk delegate, obtain demo token
      if (asRole === 'risk_delegate') {
        const signRes = await fetch('/api/v1/auth/sign-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'risk.demo', password: 'Kestrel@2026!' }),
        });
        const signData = await signRes.json();
        if (signData.requiresMfa) {
          const mfaRes = await fetch('/api/v1/auth/mfa/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaSessionId: signData.mfaSessionId, code: '123456', role: 'risk_delegate' }),
          });
          const mfaData = await mfaRes.json();
          authToken = mfaData.token;
        }
      } else if (asRole === 'secondary_owner') {
        const signRes = await fetch('/api/v1/auth/sign-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin2.demo', password: 'Kestrel@2026!' }),
        });
        const signData = await signRes.json();
        if (signData.requiresMfa) {
          const mfaRes = await fetch('/api/v1/auth/mfa/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaSessionId: signData.mfaSessionId, code: '123456', role: 'owner' }),
          });
          const mfaData = await mfaRes.json();
          authToken = mfaData.token;
        }
      }

      const res = await fetch(`/api/v1/prompt-versions/${pv.id}/approve`, {
        method: 'POST',
        headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      });

      const data = await res.json();
      if (!res.ok) {
        setPromptError(`[Governance Rule Enforced]: ${data.message || 'Approval rejected by policy'}`);
      } else {
        setPromptSuccess(`Prompt version v${pv.version_number} approved and published to production by ${asRole === 'risk_delegate' ? 'Risk Delegate' : 'Secondary Approver'}!`);
        await loadOwnerData();
      }
    } catch (err: any) {
      setPromptError(err.message || 'Approval failed');
    } finally {
      setApprovingPrompt(null);
    }
  };

  const handleRunPromptProbe = async (versionId: string) => {
    setProbeLoading(versionId);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/prompt-versions/${versionId}/test-run`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      setProbeResults((prev) => ({ ...prev, [versionId]: data }));
    } catch (err: any) {
      setProbeResults((prev) => ({ ...prev, [versionId]: { error: err.message, status: 'failed' } }));
    } finally {
      setProbeLoading(null);
    }
  };

  const handleRollbackPrompt = async (versionId: string) => {
    setRollingBackPrompt(versionId);
    setPromptError(null);
    setPromptSuccess(null);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/prompt-versions/${versionId}/rollback`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (!res.ok) {
        setPromptError(data.message || 'Rollback failed');
      } else {
        setPromptSuccess(data.message);
        await loadOwnerData();
      }
    } catch (err: any) {
      setPromptError(err.message);
    } finally {
      setRollingBackPrompt(null);
    }
  };

  const computeLineDiff = (oldText: string, newText: string) => {
    const oldLines = oldText ? oldText.split('\n') : [];
    const newLines = newText ? newText.split('\n') : [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    const diff: Array<{ type: 'added' | 'removed' | 'unchanged'; text: string }> = [];

    for (let i = 0; i < maxLen; i++) {
      const o = oldLines[i];
      const n = newLines[i];
      if (o === n) {
        if (o !== undefined) diff.push({ type: 'unchanged', text: o });
      } else {
        if (o !== undefined) diff.push({ type: 'removed', text: o });
        if (n !== undefined) diff.push({ type: 'added', text: n });
      }
    }
    return diff;
  };

  // Model Change Wizard handlers
  const handleStartWizard = async () => {
    setWizardError(null);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch('/api/v1/model-change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          targetModelId: wizardTargetModel,
          targetRole: 'primary',
          reason: wizardReason,
        }),
      });
      const data = await res.json();
      setWizardReqId(data.changeRequestId);
      setWizardStep(2);
    } catch (err: any) {
      setWizardError(err.message);
    }
  };

  const handleRunProbes = async () => {
    if (!wizardReqId) return;
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/model-change-requests/${wizardReqId}/test-probes`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      setWizardProbe(data);
      setWizardStep(5);
    } catch (err: any) {
      setWizardError(err.message);
    }
  };

  const handleApproveModelChange = async () => {
    if (!wizardReqId) return;
    setWizardError(null);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/model-change-requests/${wizardReqId}/approve`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (!res.ok) {
        setWizardError(data.message);
      } else {
        setWizardStep(8);
      }
    } catch (err: any) {
      setWizardError(err.message);
    }
  };

  // Export audit trail
  const handleExportAudit = async () => {
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch('/api/v1/audit-exports', {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      setExportedHash(data.exportSha256);
      loadOwnerData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-5 flex flex-col gap-5">
        {/* Owner Hero Banner */}
        <div className="bg-primary-container text-white p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-900/60 border border-purple-400/40 text-purple-200 flex items-center justify-center font-bold text-lg">
              SG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">Sanjay Gupta (synthetic)</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] uppercase border border-purple-400/30">
                  System Owner
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Model Observability, Telemetry & Institutional Governance Authority
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Active & Compliant</span>
            </span>

            <button
              onClick={() => {
                setShowWizard(true);
                setWizardStep(1);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-white text-primary text-xs font-bold shadow-xs hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">build_circle</span>
              <span>Model Change Wizard</span>
            </button>
          </div>
        </div>

        {/* Governance Disclaimer */}
        <GovernanceNotice contextText="System Owner Portal. System Owners have zero credit-action rights and cannot approve their own model or prompt proposals (2-Person Rule Enforced)." />

        {/* Global Navigation Sub-Tabs */}
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-[#cbd5e1] shadow-xs overflow-x-auto text-xs font-semibold">
          {[
            { key: 'telemetry', label: 'Spend & Telemetry', icon: 'monitoring' },
            { key: 'agents', label: 'Agents & LLM Calls', icon: 'hub' },
            { key: 'models', label: 'Model Registry', icon: 'view_in_ar' },
            { key: 'prompts', label: 'Prompt Governance', icon: 'edit_note' },
            { key: 'evals', label: '7-Metric Evals', icon: 'fact_check' },
            { key: 'audit', label: 'Append-Only Audit Trail', icon: 'history_edu' },
            { key: 'users', label: 'Access & RBAC', icon: 'group' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === tab.key ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 1. SPEND & TELEMETRY */}
        {activeTab === 'telemetry' && costsSummary && (
          <div className="flex flex-col gap-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col">
                <span className="text-xs text-on-surface-variant">Estimated Spend (USD)</span>
                <span className="text-2xl font-bold text-primary tnum mt-1">
                  ${costsSummary.summary?.totalEstimatedCostUSD || costsSummary.summary?.totalEstimatedCostINR || '0.00'}
                </span>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded w-fit mt-1 font-bold">
                  Estimated Cost (USD)
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col">
                <span className="text-xs text-on-surface-variant">Token Velocity</span>
                <span className="text-2xl font-bold text-on-surface tnum mt-1">
                  {((costsSummary.summary?.totalInputTokens + costsSummary.summary?.totalOutputTokens) || 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-1">
                  In: {costsSummary.summary?.totalInputTokens} | Out: {costsSummary.summary?.totalOutputTokens}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col">
                <span className="text-xs text-on-surface-variant">System Latency (P95)</span>
                <span className="text-2xl font-bold text-emerald-700 tnum mt-1">480ms</span>
                <span className="text-[10px] text-emerald-600 mt-1 font-semibold">Under 1200ms SLA</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col">
                <span className="text-xs text-on-surface-variant">Model Fallback Rate</span>
                <span className="text-2xl font-bold text-blue-700 tnum mt-1">0.0%</span>
                <span className="text-[10px] text-slate-500 mt-1">Primary model active</span>
              </div>
            </div>

            {/* Daily Spend Breakdown Chart */}
            <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col gap-3">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Daily Estimated Spend (USD)
              </h3>
              <div className="h-56 w-full bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costsSummary.daily?.slice(0, 14)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="costUSD" name="Estimated Cost ($)" fill="#6d28d9" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Observability, Latency Percentiles & Traces (Feature E) */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 flex flex-col gap-5 text-xs">
              {/* Observability Header & Latency SLA */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-[#e2e8f0] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-700 text-[20px]">query_stats</span>
                    <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                      Underwriting Pipeline Observability & Trace Waterfall
                    </h3>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Distributed tracing across deterministic arithmetic engines, simulated OCR, and model gateway calls.
                  </p>
                </div>

                {/* Telemetry Percentiles Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="bg-[#f8fafc] border border-slate-200 px-2.5 py-1 rounded-lg text-center font-mono">
                    <span className="block text-[9px] text-slate-500 uppercase">P50 Latency</span>
                    <strong className="text-xs text-primary">{latencyData?.latency?.p50 || 180}ms</strong>
                  </div>
                  <div className="bg-[#f8fafc] border border-slate-200 px-2.5 py-1 rounded-lg text-center font-mono">
                    <span className="block text-[9px] text-slate-500 uppercase">P90 Latency</span>
                    <strong className="text-xs text-primary">{latencyData?.latency?.p90 || 420}ms</strong>
                  </div>
                  <div className="bg-[#f8fafc] border border-slate-200 px-2.5 py-1 rounded-lg text-center font-mono">
                    <span className="block text-[9px] text-slate-500 uppercase">P95 Latency</span>
                    <strong className="text-xs text-emerald-700">{latencyData?.latency?.p95 || 580}ms</strong>
                  </div>
                  <div className="bg-[#f8fafc] border border-slate-200 px-2.5 py-1 rounded-lg text-center font-mono">
                    <span className="block text-[9px] text-slate-500 uppercase">P99 Latency</span>
                    <strong className="text-xs text-amber-700">{latencyData?.latency?.p99 || 920}ms</strong>
                  </div>
                </div>
              </div>

              {/* Trace Pipeline Selector */}
              {tracesData.length > 0 && (() => {
                const currentTrace = tracesData.find((t) => t.traceId === selectedTraceId) || tracesData[0];

                return (
                  <div className="flex flex-col gap-4">
                    {/* Pipeline Switcher Bar */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#f8fafc] p-3 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">Select Pipeline Trace:</span>
                        <select
                          value={currentTrace.traceId}
                          onChange={(e) => {
                            setSelectedTraceId(e.target.value);
                            setSelectedSpan(null);
                          }}
                          className="bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 cursor-pointer"
                        >
                          {tracesData.map((t) => (
                            <option key={t.traceId} value={t.traceId}>
                              {t.workflowName} ({t.applicationId})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span>Duration: <strong className="text-primary">{currentTrace.totalDurationMs}ms</strong></span>
                        <span>Tokens: <strong>{currentTrace.totalTokens}</strong></span>
                        <span>Cost: <strong className="text-purple-800">${(currentTrace.estimatedCostUSD || currentTrace.estimatedCostINR || 0).toFixed(4)}</strong></span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          {currentTrace.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Flamegraph / Waterfall Visual Timeline */}
                    <div className="flex flex-col gap-2 p-4 bg-[#0f172a] rounded-xl text-slate-200 border border-slate-800">
                      {/* Timeline Ruler */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-700 pb-1">
                        <span>0ms</span>
                        <span>{Math.round(currentTrace.totalDurationMs * 0.25)}ms</span>
                        <span>{Math.round(currentTrace.totalDurationMs * 0.5)}ms</span>
                        <span>{Math.round(currentTrace.totalDurationMs * 0.75)}ms</span>
                        <span>{currentTrace.totalDurationMs}ms</span>
                      </div>

                      {/* Span Gantt Bars */}
                      <div className="flex flex-col gap-2 pt-2">
                        {currentTrace.spans.map((sp: any) => {
                          const leftPct = (sp.startTimeOffsetMs / currentTrace.totalDurationMs) * 100;
                          const widthPct = Math.max((sp.durationMs / currentTrace.totalDurationMs) * 100, 3);
                          const isSelected = selectedSpan?.id === sp.id;

                          return (
                            <div
                              key={sp.id}
                              onClick={() => setSelectedSpan(sp)}
                              className={`group cursor-pointer rounded-lg p-2 transition-all border ${
                                isSelected
                                  ? 'bg-slate-800 border-purple-400 ring-1 ring-purple-400/50'
                                  : 'hover:bg-slate-800/60 border-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] mb-1.5 font-sans">
                                <div className="flex items-center gap-2 truncate">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: sp.serviceColor || '#38bdf8' }}
                                  ></span>
                                  <span className="font-semibold text-slate-200 truncate">{sp.spanName}</span>
                                  <span className="text-[9px] font-mono uppercase text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                                    {sp.serviceType}
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                  +{sp.startTimeOffsetMs}ms • <strong>{sp.durationMs}ms</strong>
                                </span>
                              </div>

                              {/* Relative Waterfall Bar */}
                              <div className="w-full bg-slate-800 h-3 rounded-full relative overflow-hidden">
                                <div
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    backgroundColor: sp.serviceColor || '#38bdf8',
                                  }}
                                  className="absolute top-0 bottom-0 rounded-full transition-all group-hover:brightness-125 shadow-xs"
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Span Telemetry Inspector */}
                    {selectedSpan ? (
                      <div className="p-4 bg-[#f8fafc] rounded-xl border border-purple-200 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-purple-700 text-[18px]">terminal</span>
                            <span className="font-bold text-slate-900 text-xs">Span Inspector: {selectedSpan.spanName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedSpan(null)}
                            className="text-slate-400 hover:text-slate-700 font-bold"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono">
                          <div>Service Type: <strong className="text-primary">{selectedSpan.serviceType}</strong></div>
                          <div>Duration: <strong>{selectedSpan.durationMs}ms</strong></div>
                          <div>Tokens: <strong>{selectedSpan.tokens?.total || selectedSpan.tokens || 0}</strong></div>
                          <div>Status: <strong className="text-emerald-700 uppercase">{selectedSpan.status}</strong></div>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700">
                          <strong>Execution Narrative:</strong> {selectedSpan.details}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-[11px] text-slate-400 py-1 font-mono italic">
                        Tip: Click on any flamegraph span above to inspect its execution narrative, service boundaries, and telemetry.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 2. AGENTS & LLM CALL INSPECTOR */}
        {activeTab === 'agents' && (
          <div className="flex flex-col gap-5">
            {/* Agent Table */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Underwriting Agent Ledger
                </h3>
                <span className="text-xs font-mono text-on-surface-variant">{agents.length} Registered Agents</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f8fafc] text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                      <th className="py-2.5 px-4">Agent Name</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Assigned Model</th>
                      <th className="py-2.5 px-4">P95 Latency</th>
                      <th className="py-2.5 px-4">Cost / Execution</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {agents.map((ag) => (
                      <tr key={ag.id} className="hover:bg-[#f8fafc]/80">
                        <td className="py-3 px-4 font-bold text-on-surface">{ag.name}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            ag.type === 'llm_agent' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {ag.type === 'llm_agent' ? 'LLM AGENT' : 'DETERMINISTIC'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-on-surface-variant">{ag.modelClass}</td>
                        <td className="py-3 px-4 font-mono">{ag.latencyP95}</td>
                        <td className="py-3 px-4 font-mono">{ag.costPerCall}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={ag.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* LLM Call Inspector */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    LLM Call Inspector (Append-Only Log)
                  </h3>
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-bold uppercase mt-0.5 inline-block">
                    Estimated Cost Calculations
                  </span>
                </div>
                <span className="text-xs font-mono text-on-surface-variant">{llmCalls.length} Calls Recorded</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f8fafc] text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                      <th className="py-2.5 px-4">Call ID & Timestamp</th>
                      <th className="py-2.5 px-4">Agent</th>
                      <th className="py-2.5 px-4">Model & Provider</th>
                      <th className="py-2.5 px-4">Token Breakdown</th>
                      <th className="py-2.5 px-4">Estimated Cost (USD)</th>
                      <th className="py-2.5 px-4 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {llmCalls.map((call) => (
                      <tr key={call.call_id} className="hover:bg-[#f8fafc]/80">
                        <td className="py-3 px-4">
                          <span className="font-mono text-primary font-bold">{call.call_id}</span>
                          <span className="block text-[10px] text-on-surface-variant font-mono">{call.timestamp}</span>
                        </td>
                        <td className="py-3 px-4 font-bold">{call.agent_name}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-on-surface-variant">
                          {call.model_id} ({call.provider})
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          In: {call.input_tokens} | Out: {call.output_tokens}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-purple-700">
                          ${call.estimated_cost}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectCall(call)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. MODEL REGISTRY & 8-STEP CHANGE WIZARD */}
        {activeTab === 'models' && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {models.map((m) => (
                <div key={m.model_id} className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface font-mono">{m.model_id}</span>
                      <StatusBadge status={m.residency_status} />
                    </div>
                    <span className="text-[11px] text-on-surface-variant">Provider: {m.provider} • {m.deployment}</span>
                    <span className="text-[10px] font-mono text-slate-500">Region: {m.region}</span>
                  </div>

                  <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0] text-[11px] font-mono flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span>Input Price / 1M:</span>
                      <span className="font-bold">${m.input_price_per_million}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Output Price / 1M:</span>
                      <span className="font-bold">${m.output_price_per_million}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {m.isPrimary && (
                      <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded">PRIMARY</span>
                    )}
                    {m.isFallback && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">FALLBACK</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. PROMPT GOVERNANCE & VERSION EDITOR */}
        {activeTab === 'prompts' && (
          <div className="flex flex-col gap-4 text-xs">
            {/* Control & Agent Filter Bar */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Prompt Version Governance Console</h3>
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">
                    2-Person Rule Enforced
                  </span>
                </div>
                <p className="text-on-surface-variant text-[11px]">
                  Institutional prompt versioning. Authors cannot approve their own versions. Credit-relevant prompts require Risk Delegate authorization.
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 font-bold text-xs flex-1 md:flex-none cursor-pointer"
                >
                  <option value="bank-extractor">Bank Statement Extractor</option>
                  <option value="gst-extractor">GST Return Extractor</option>
                  <option value="cam-draft">CAM Synthesis Drafter</option>
                  <option value="followup-draft">Borrower Follow-up Drafter</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const active = promptVersions.find((v) => v.status === 'published');
                    setNewPromptBody(active ? active.body : '');
                    setNewChangeNote('');
                    setShowCreatePromptModal(true);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-primary hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>Propose New Version</span>
                </button>
              </div>
            </div>

            {/* Notifications / Feedback Banners */}
            {promptError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5 shadow-xs">
                <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0">gavel</span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">Governance Policy Check</span>
                  <span>{promptError}</span>
                </div>
              </div>
            )}

            {promptSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 shadow-xs">
                <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">check_circle</span>
                <span className="font-medium">{promptSuccess}</span>
              </div>
            )}

            {/* Version List Cards */}
            <div className="flex flex-col gap-4">
              {promptVersions.map((pv) => {
                const isPublished = pv.status === 'published';
                const isPending = pv.status === 'pending_approval';
                const isSuperseded = pv.status === 'superseded';
                const activePublished = promptVersions.find((v) => v.status === 'published');
                const showDiff = diffVersionId === pv.id && activePublished && activePublished.id !== pv.id;
                const probe = probeResults[pv.id];

                return (
                  <div
                    key={pv.id}
                    className={`bg-white rounded-xl border p-4.5 shadow-xs flex flex-col gap-3 transition-all ${
                      isPublished
                        ? 'border-emerald-300 ring-1 ring-emerald-400/30'
                        : isPending
                        ? 'border-amber-300 ring-1 ring-amber-400/30'
                        : 'border-[#e2e8f0]'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#f1f5f9] pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-primary font-mono text-sm">v{pv.version_number}</span>
                        <StatusBadge status={pv.status} />
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            pv.risk_class === 'credit_relevant'
                              ? 'text-purple-800 bg-purple-100 border border-purple-200'
                              : 'text-blue-800 bg-blue-100 border border-blue-200'
                          }`}
                        >
                          {pv.risk_class === 'credit_relevant' ? 'Credit-Relevant (Risk Sign-off Required)' : 'Operational'}
                        </span>
                        {isPublished && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            ACTIVE IN PRODUCTION
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-on-surface-variant font-mono">
                        <span>Author: {pv.author_id}</span>
                        {pv.approver_id && <span>Approver: {pv.approver_id}</span>}
                        <span>{pv.created_at}</span>
                      </div>
                    </div>

                    {/* Change Note */}
                    <div className="text-[11px] text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                      <strong>Change Note:</strong> {pv.change_note}
                    </div>

                    {/* Prompt Body */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                        Prompt Instruction Template:
                      </span>
                      <pre className="font-mono text-[11px] bg-[#0f172a] text-slate-200 p-3.5 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {pv.body}
                      </pre>
                    </div>

                    {/* Line Diff View vs Active Published */}
                    {showDiff && activePublished && (
                      <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">difference</span>
                            Line Diff vs Active Production (v{activePublished.version_number})
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">+ Added, - Removed</span>
                        </div>
                        <div className="font-mono text-[11px] bg-white p-2.5 rounded border border-slate-200 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                          {computeLineDiff(activePublished.body, pv.body).map((d, idx) => (
                            <div
                              key={idx}
                              className={`px-1.5 py-0.5 rounded ${
                                d.type === 'added'
                                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                  : d.type === 'removed'
                                  ? 'bg-red-50 text-red-800 line-through'
                                  : 'text-slate-600'
                              }`}
                            >
                              {d.type === 'added' ? '+ ' : d.type === 'removed' ? '- ' : '  '}
                              {d.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Probe Result Box */}
                    {probe && (
                      <div
                        className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                          probe.status === 'passed' ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <span className="material-symbols-outlined text-[16px]">
                              {probe.status === 'passed' ? 'check_circle' : 'error'}
                            </span>
                            <span>Synthetic Test Probe Execution</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[10px]">
                            <span>Latency: <strong>{probe.durationMs}ms</strong></span>
                            {probe.inputTokens !== undefined && (
                              <span>Tokens: <strong>{probe.inputTokens} in / {probe.outputTokens} out</strong></span>
                            )}
                            {probe.estimatedCost !== undefined && (
                              <span>Cost: <strong>${probe.estimatedCost.toFixed(4)}</strong></span>
                            )}
                          </div>
                        </div>
                        {probe.output && (
                          <div className="bg-white/80 p-2 rounded border border-emerald-200 text-[11px] font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {probe.output}
                          </div>
                        )}
                        {probe.error && (
                          <div className="text-[11px] text-red-700 font-medium">{probe.error}</div>
                        )}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#f1f5f9]">
                      <div className="flex items-center gap-2">
                        {/* Run Synthetic Probe */}
                        <button
                          type="button"
                          onClick={() => handleRunPromptProbe(pv.id)}
                          disabled={probeLoading === pv.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">science</span>
                          <span>{probeLoading === pv.id ? 'Running Probe...' : 'Run Synthetic Probe'}</span>
                        </button>

                        {/* Toggle Line Diff */}
                        {activePublished && activePublished.id !== pv.id && (
                          <button
                            type="button"
                            onClick={() => setDiffVersionId(diffVersionId === pv.id ? null : pv.id)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">difference</span>
                            <span>{showDiff ? 'Hide Line Diff' : 'View Line Diff'}</span>
                          </button>
                        )}
                      </div>

                      {/* Approval & Governance Controls */}
                      {isPending && (
                        <div className="flex flex-wrap items-center gap-2">
                          {/* 1. Author self-approval test button */}
                          <button
                            type="button"
                            onClick={() => handleApprovePromptVersion(pv, 'self')}
                            disabled={approvingPrompt === pv.id}
                            className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[10px] shadow-xs flex items-center gap-1 cursor-pointer"
                            title="Test author self-approval block (will be rejected per 2-person policy)"
                          >
                            <span className="material-symbols-outlined text-[13px]">gavel</span>
                            <span>Approve as Author (Self)</span>
                          </button>

                          {/* 2. Secondary Approver simulator */}
                          <button
                            type="button"
                            onClick={() => handleApprovePromptVersion(pv, pv.risk_class === 'credit_relevant' ? 'risk_delegate' : 'secondary_owner')}
                            disabled={approvingPrompt === pv.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">verified_user</span>
                            <span>
                              {pv.risk_class === 'credit_relevant'
                                ? 'Authorize as Risk Delegate (Meera)'
                                : 'Authorize as Secondary Owner (Rajesh)'}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Rollback Control */}
                      {isSuperseded && (
                        <button
                          type="button"
                          onClick={() => handleRollbackPrompt(pv.id)}
                          disabled={rollingBackPrompt === pv.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">history</span>
                          <span>{rollingBackPrompt === pv.id ? 'Rolling back...' : `Rollback to v${pv.version_number}`}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. 7-METRIC EVALUATIONS */}
        {activeTab === 'evals' && (
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 flex flex-col gap-4 text-xs">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              7 Underwriting Quality Evaluation Metrics (Golden Dataset v3.2)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {evalMetrics.map((em) => (
                <div key={em.key} className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-on-surface">{em.label}</span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      Passed
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-lg font-bold text-primary tnum">{(em.score * 100).toFixed(1)}%</span>
                    <span className="text-[10px] font-mono text-slate-500">Threshold: {(em.threshold * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. IMMUTABLE AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Cryptographic Append-Only Audit Trail
                </h3>
                <span className="text-[10px] text-slate-500">
                  SQLite database triggers permanently block UPDATE and DELETE. SHA-256 hash chained.
                </span>
              </div>

              <button
                type="button"
                onClick={handleExportAudit}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold shadow-xs hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">file_download</span>
                <span>Export Audit Trail</span>
              </button>
            </div>

            {exportedHash && (
              <div className="mx-5 my-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex flex-col gap-1">
                <strong>Audit Export Event Generated:</strong>
                <span className="font-mono text-[10px] truncate">Export SHA-256 Hash: {exportedHash}</span>
              </div>
            )}

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                    <th className="py-2.5 px-4">Timestamp & ID</th>
                    <th className="py-2.5 px-4">Entity & Action</th>
                    <th className="py-2.5 px-4">Actor</th>
                    <th className="py-2.5 px-4 font-mono">SHA-256 Current Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {auditEvents.slice(0, 30).map((ev) => (
                    <tr key={ev.id} className="hover:bg-[#f8fafc]/80">
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-primary">{ev.id}</span>
                        <span className="block text-[10px] text-slate-400">{ev.timestamp}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-on-surface">{ev.action}</span>
                        <span className="block text-[10px] text-on-surface-variant font-mono">
                          {ev.entity_type} • {ev.entity_id}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {ev.actor_role.toUpperCase()} ({ev.actor_id})
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500 truncate max-w-xs">
                        {ev.hash}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. USERS & RBAC ACCESS */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 flex flex-col gap-4 text-xs">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Institutional User Directory & RBAC
            </h3>

            <div className="overflow-x-auto border border-[#e2e8f0] rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f8fafc] text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                    <th className="py-2.5 px-4">Full Name</th>
                    <th className="py-2.5 px-4">Username & Email</th>
                    <th className="py-2.5 px-4">Assigned Roles</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#f8fafc]/80">
                      <td className="py-3 px-4 font-bold text-on-surface">{u.full_name}</td>
                      <td className="py-3 px-4 font-mono text-on-surface-variant">{u.email}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {u.roles.map((r: string) => (
                            <span key={r} className="text-[10px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                              {r.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 8-Step Model Change Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-xl flex flex-col gap-4 border border-[#cbd5e1] animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2 text-primary">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">build_circle</span>
                <h3 className="text-sm font-bold text-on-surface">8-Step Model Change Wizard</h3>
              </div>
              <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                Step {wizardStep} of 8
              </span>
            </div>

            {wizardError && (
              <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800">
                {wizardError}
              </div>
            )}

            {/* Step 1: Propose Model */}
            {wizardStep === 1 && (
              <div className="flex flex-col gap-3">
                <p className="text-on-surface-variant">Step 1: Propose underwriting model change and target role.</p>
                <div>
                  <label className="font-bold text-on-surface block mb-1">Target Model</label>
                  <select
                    value={wizardTargetModel}
                    onChange={(e) => setWizardTargetModel(e.target.value)}
                    className="w-full p-2 border border-[#cbd5e1] rounded-lg bg-[#f8fafc]"
                  >
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (asia-south1)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (asia-south1)</option>
                    <option value="simulated-deterministic">Simulated Deterministic Engine</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-on-surface block mb-1">Change Justification</label>
                  <textarea
                    rows={2}
                    value={wizardReason}
                    onChange={(e) => setWizardReason(e.target.value)}
                    className="w-full p-2 border border-[#cbd5e1] rounded-lg bg-[#f8fafc]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowWizard(false)} className="px-3 py-1.5 border rounded-lg">Cancel</button>
                  <button onClick={handleStartWizard} className="px-4 py-1.5 bg-primary text-white font-bold rounded-lg">
                    Next: Run Compatibility Probes
                  </button>
                </div>
              </div>
            )}

            {/* Step 2-4: Compatibility & Connectivity */}
            {(wizardStep >= 2 && wizardStep < 5) && (
              <div className="flex flex-col gap-3">
                <p className="text-on-surface-variant">Step 2-4: Automated compatibility and synthetic connectivity test.</p>
                <div className="bg-[#f8fafc] p-3 rounded-lg border border-[#e2e8f0] flex flex-col gap-1">
                  <span>Target Model: <strong>{wizardTargetModel}</strong></span>
                  <span>Synthetic Data Only Enforcement: <strong className="text-emerald-700">Verified</strong></span>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={handleRunProbes} className="px-4 py-1.5 bg-secondary text-white font-bold rounded-lg">
                    Execute Synthetic Connectivity Probe
                  </button>
                </div>
              </div>
            )}

            {/* Step 5-7: Second-Approver Authorization */}
            {(wizardStep >= 5 && wizardStep < 8) && (
              <div className="flex flex-col gap-3">
                <p className="text-on-surface-variant">
                  Step 6: Second-Approver Authorization.
                  <strong className="block text-red-700 mt-1">Rule: Proposer cannot approve their own change. Secondary administrator authorization required.</strong>
                </p>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex flex-col gap-1 text-[11px] text-amber-900">
                  <span>Running jobs finish on current configuration.</span>
                  <span>Scheduled Effective Time: In 5 minutes.</span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={handleApproveModelChange} className="px-4 py-1.5 bg-primary text-white font-bold rounded-lg">
                    Authorize Model Change (Secondary Approver)
                  </button>
                </div>
              </div>
            )}

            {/* Step 8: Success */}
            {wizardStep === 8 && (
              <div className="flex flex-col gap-3 text-center py-4">
                <span className="material-symbols-outlined text-[40px] text-emerald-600 mx-auto">check_circle</span>
                <h4 className="text-sm font-bold text-on-surface">Model Change Scheduled Successfully</h4>
                <p className="text-on-surface-variant text-xs">
                  The new model configuration has been published and audited. In-flight jobs will finish on the previous model.
                </p>
                <button onClick={() => setShowWizard(false)} className="px-4 py-1.5 bg-primary text-white font-bold rounded-lg mt-2 mx-auto">
                  Close Wizard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LLM Call Inspector Modal */}
      {inspectCall && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-5 shadow-xl flex flex-col gap-3 border border-[#cbd5e1] text-xs">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
              <span className="font-bold text-xs text-primary font-mono">{inspectCall.call_id}</span>
              <button onClick={() => setInspectCall(null)} className="font-bold text-slate-500 hover:text-black">✕</button>
            </div>

            <div className="bg-[#f8fafc] p-3 rounded-lg border border-[#e2e8f0] flex flex-col gap-1 font-mono text-[11px]">
              <div>Agent: <strong>{inspectCall.agent_name}</strong></div>
              <div>Model: <strong>{inspectCall.model_id} ({inspectCall.provider})</strong></div>
              <div>Tokens: In {inspectCall.input_tokens} | Out {inspectCall.output_tokens}</div>
              <div>Duration: {inspectCall.duration_ms}ms</div>
              <div className="pt-2 border-t border-[#e2e8f0] text-purple-800">
                <strong>Price Calculation:</strong>
                <p className="text-[10px] mt-0.5">{inspectCall.costCalculationExplanation}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Propose New Prompt Version Modal */}
      {showCreatePromptModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePromptVersion}
            className="bg-white max-w-xl w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-4 border border-[#cbd5e1] text-xs"
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-on-surface">Propose New Prompt Version</h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Target Service: <strong className="text-primary font-mono">{selectedAgent}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePromptModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface block mb-1">
                Prompt Instruction Template
              </label>
              <textarea
                rows={6}
                value={newPromptBody}
                onChange={(e) => setNewPromptBody(e.target.value)}
                placeholder="Enter revised system/agent instruction prompt..."
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-3 text-xs font-mono text-slate-800 leading-relaxed"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface block mb-1">
                Mandatory Change Note
              </label>
              <input
                type="text"
                value={newChangeNote}
                onChange={(e) => setNewChangeNote(e.target.value)}
                placeholder="E.g. Calibrated variance threshold for negative operative bank credits"
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2 text-xs text-on-surface font-medium"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface block mb-1">
                Risk Classification & Two-Person Approval Governance
              </label>
              <select
                value={promptRiskClass}
                onChange={(e) => setPromptRiskClass(e.target.value as any)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2 text-xs font-semibold text-on-surface cursor-pointer"
              >
                <option value="credit_relevant">
                  Credit-Relevant (Modifies extraction, ratios, or CAM — Requires Risk Delegate sign-off)
                </option>
                <option value="operational">
                  Operational (Formatting, tone, or follow-up wording — Requires Secondary Owner sign-off)
                </option>
              </select>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[11px] text-amber-900 flex flex-col gap-1">
              <strong>Two-Person Authorization Policy:</strong>
              <span>
                Under Kestrel governance rules, the author cannot approve their own prompt version. Once submitted, this version will enter <code>pending_approval</code> status until authorized by an independent reviewer.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setShowCreatePromptModal(false)}
                className="px-4 py-2 rounded-lg border border-[#cbd5e1] text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPrompt || !newPromptBody.trim() || !newChangeNote.trim()}
                className="px-5 py-2 rounded-lg bg-primary hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>{savingPrompt ? 'Submitting...' : 'Submit for Two-Person Approval'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
