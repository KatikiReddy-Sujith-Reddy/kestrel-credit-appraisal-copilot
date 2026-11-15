import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import GovernanceNotice from '../../components/GovernanceNotice';
import StatusBadge from '../../components/StatusBadge';

export default function RmDashboard() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'documents_pending' | 'verification_queue' | 'credit_review'>('all');
  const [pilotOnly, setPilotOnly] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchApplications();
  }, [activeTab, pilotOnly, search]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('status', activeTab);
      if (pilotOnly) params.set('pilotOnly', 'true');
      if (search) params.set('search', search);

      const res = await fetch(`/api/v1/applications?${params.toString()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      setApplications(data.applications || []);
    } catch (err) {
      console.error('Failed to fetch applications', err);
    } finally {
      setLoading(false);
    }
  };

  // Vitals counts
  const totalActive = applications.length;
  const pendingDocsCount = applications.filter(a => a.status === 'documents_pending').length;
  const verificationReadyCount = applications.filter(a => a.status === 'verification_queue').length;
  const creditReviewCount = applications.filter(a => a.status === 'credit_review').length;

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Governance Disclaimer */}
        <GovernanceNotice contextText="Relationship Manager workspace. Verify checklist completeness before transmitting files to credit underwriting." />

        {/* Portfolio Vitals Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col">
            <span className="text-xs text-on-surface-variant font-medium">Active Applications</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-on-surface tnum">{totalActive}</span>
              <span className="text-[11px] text-emerald-600 font-semibold">In Scope</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col">
            <span className="text-xs text-on-surface-variant font-medium">Pending Missing Docs</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-amber-600 tnum">{pendingDocsCount}</span>
              <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Action Req</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col">
            <span className="text-xs text-on-surface-variant font-medium">Ready for Verification</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-blue-600 tnum">{verificationReadyCount}</span>
              <span className="text-[11px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-medium">Analyst Queue</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col">
            <span className="text-xs text-on-surface-variant font-medium">Credit Review</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-800 tnum">{creditReviewCount}</span>
              <span className="text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">CM Stage</span>
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-lg overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'all' ? 'bg-white text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              All Files
            </button>
            <button
              onClick={() => setActiveTab('documents_pending')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'documents_pending' ? 'bg-white text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Pending Docs ({pendingDocsCount})
            </button>
            <button
              onClick={() => setActiveTab('verification_queue')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'verification_queue' ? 'bg-white text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Analyst Queue ({verificationReadyCount})
            </button>
            <button
              onClick={() => setActiveTab('credit_review')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'credit_review' ? 'bg-white text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Credit Review ({creditReviewCount})
            </button>
          </div>

          {/* Pilot Scope & Search */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer bg-[#f8fafc] border border-[#cbd5e1] px-3 py-1.5 rounded-lg text-xs font-medium">
              <input
                type="checkbox"
                checked={pilotOnly}
                onChange={(e) => setPilotOnly(e.target.checked)}
                className="accent-secondary rounded"
              />
              <span>Pilot Scope (&le; $250,000)</span>
            </label>

            <div className="relative flex items-center bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-2.5 py-1.5">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant mr-1.5">search</span>
              <input
                type="text"
                placeholder="Search business..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-on-surface focus:outline-none w-36 sm:w-48"
              />
            </div>
          </div>
        </div>

        {/* Applications Ledger Table */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Active Borrower Applications</h2>
            <span className="text-xs text-on-surface-variant font-mono">{applications.length} applications loaded</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                  <th className="py-2.5 px-4">Application</th>
                  <th className="py-2.5 px-4">Facility & Amount</th>
                  <th className="py-2.5 px-4">Checklist Progress</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                      Loading portfolio pipeline...
                    </td>
                  </tr>
                ) : applications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                      No applications match the active filters.
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app.id} className="hover:bg-[#f8fafc]/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">{app.business_name}</span>
                          <span className="text-[11px] font-mono text-on-surface-variant">{app.application_number}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface tnum">
                            ${app.loan_amount.toLocaleString('en-US')}
                          </span>
                          <span className="text-[11px] text-on-surface-variant truncate max-w-xs">{app.loan_product}</span>
                          {!app.pilotScopeFlag && (
                            <span className="text-[9px] font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded w-fit mt-0.5">
                              Outside Pilot Scope
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 w-44">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-medium text-on-surface-variant">
                              {app.checklistTotal - app.checklistMissing}/{app.checklistTotal} Docs
                            </span>
                            <span className="font-bold text-on-surface tnum">
                              {Math.round((app.completeness_score || 0) * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                app.completeness_score >= 1.0 ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.round((app.completeness_score || 0) * 100)}%` }}
                            ></div>
                          </div>
                          {app.checklistMissing > 0 && (
                            <span className="text-[10px] text-amber-700 font-medium">
                              {app.checklistMissing} item(s) missing or invalid
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={app.status} />
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/rm/applications/${app.id}`)}
                          className="px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-[#005a54] transition-colors shadow-xs inline-flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
