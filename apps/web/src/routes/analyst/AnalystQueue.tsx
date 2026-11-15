import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import GovernanceNotice from '../../components/GovernanceNotice';
import StatusBadge from '../../components/StatusBadge';

export default function AnalystQueue() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedView, setSavedView] = useState<'needs_verification' | 'discrepancies' | 'returned' | 'all'>('needs_verification');

  useEffect(() => {
    fetchQueue();
  }, [savedView]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch('/api/v1/applications', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      let apps = data.applications || [];

      // Filter by saved view
      if (savedView === 'needs_verification') {
        apps = apps.filter((a: any) => a.status === 'verification_queue');
      } else if (savedView === 'discrepancies') {
        apps = apps.filter((a: any) => a.discrepancies && a.discrepancies.length > 0);
      } else if (savedView === 'returned') {
        apps = apps.filter((a: any) => a.status === 'returned_to_analyst');
      }

      setApplications(apps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
        <GovernanceNotice contextText="Credit Analyst Underwriting Queue. Verify extractions against source documents and reconcile bank versus GST turnover." />

        {/* Saved Views Tabs */}
        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-[#f1f5f9] p-1 rounded-lg overflow-x-auto">
            <button
              onClick={() => setSavedView('needs_verification')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                savedView === 'needs_verification' ? 'bg-white text-on-surface shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-blue-600">fact_check</span>
              <span>Needs Verification</span>
            </button>

            <button
              onClick={() => setSavedView('discrepancies')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                savedView === 'discrepancies' ? 'bg-white text-on-surface shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-amber-600">sync_problem</span>
              <span>Material Discrepancies</span>
            </button>

            <button
              onClick={() => setSavedView('returned')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                savedView === 'returned' ? 'bg-white text-on-surface shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-red-600">reply</span>
              <span>Returned by Credit Manager</span>
            </button>

            <button
              onClick={() => setSavedView('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                savedView === 'all' ? 'bg-white text-on-surface shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              All Underwriting Files
            </button>
          </div>

          <span className="text-xs font-mono text-on-surface-variant self-end md:self-auto">
            {applications.length} files in active queue
          </span>
        </div>

        {/* Queue Table */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Analyst Verification Queue</h2>
            <span className="text-[11px] font-mono text-on-surface-variant">SLA: 48h Hands-on Window</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                  <th className="py-2.5 px-4">Borrower Entity</th>
                  <th className="py-2.5 px-4">Facility Amount</th>
                  <th className="py-2.5 px-4">Loan Product</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                      Loading analyst queue...
                    </td>
                  </tr>
                ) : applications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                      No files currently pending in this view.
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

                      <td className="py-3 px-4 font-bold text-on-surface tnum">
                        ${app.loan_amount.toLocaleString('en-US')}
                      </td>

                      <td className="py-3 px-4 text-on-surface-variant">
                        {app.loan_product}
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={app.status} />
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/analyst/applications/${app.id}`)}
                          className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs inline-flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[15px]">table_chart</span>
                          <span>Open Workspace</span>
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
