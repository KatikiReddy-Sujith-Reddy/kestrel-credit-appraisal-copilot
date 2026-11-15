import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import GovernanceNotice from '../../components/GovernanceNotice';
import StatusBadge from '../../components/StatusBadge';

export default function CreditManagerQueue() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch('/api/v1/credit-review/queue', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      setQueue(data.queue || []);
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
        <GovernanceNotice contextText="Credit Manager Stage. Formal credit sanction is a manual step in the production Loan Origination System (LOS). This copilot does not make credit decisions." />

        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Credit Appraisal Review Queue</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Verified Credit Appraisal Memorandums submitted by Credit Analysts awaiting management appraisal.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 px-3 py-1 rounded-md text-on-surface-variant">
              {queue.length} Pending Review
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                  <th className="py-2.5 px-4">Borrower Entity</th>
                  <th className="py-2.5 px-4">Facility & Amount</th>
                  <th className="py-2.5 px-4">Underwriting Analyst</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                      Loading credit review queue...
                    </td>
                  </tr>
                ) : queue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                      No files currently awaiting credit review.
                    </td>
                  </tr>
                ) : (
                  queue.map((app) => (
                    <tr key={app.id} className="hover:bg-[#f8fafc]/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">{app.business_name}</span>
                          <span className="text-[11px] font-mono text-on-surface-variant">{app.application_number}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-on-surface tnum">
                        ${app.loan_amount.toLocaleString('en-US')}
                        <span className="block font-normal text-[11px] text-on-surface-variant">{app.loan_product}</span>
                      </td>

                      <td className="py-3 px-4 text-on-surface-variant">
                        {app.analyst_name || 'Arjun Menon (synthetic)'}
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={app.status} />
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/credit/applications/${app.id}`)}
                          className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs inline-flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[15px]">rate_review</span>
                          <span>Conduct Review</span>
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
