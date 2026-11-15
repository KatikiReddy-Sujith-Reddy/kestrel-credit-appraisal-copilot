import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import GovernanceNotice from '../../components/GovernanceNotice';
import StatusBadge from '../../components/StatusBadge';

export default function CreditManagerReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [application, setApplication] = useState<any>(null);
  const [camDraft, setCamDraft] = useState<any>(null);
  const [ratios, setRatios] = useState<any[]>([]);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals for actions
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [returning, setReturning] = useState(false);

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeComment, setCompleteComment] = useState('Comprehensive underwriting appraisal reviewed. File verified against credit policy tolerances and recommended for manual committee sanction.');
  const [losReference, setLosReference] = useState(`LOS-SME-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [completing, setCompleting] = useState(false);

  // Source evidence popover state
  const [activeCitation, setActiveCitation] = useState<any>(null);

  useEffect(() => {
    loadReviewData();
  }, [id]);

  const loadReviewData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      const appRes = await fetch(`/api/v1/applications/${id}`, { headers });
      const appData = await appRes.json();
      setApplication(appData.application);

      const camRes = await fetch(`/api/v1/applications/${id}/cam-draft`, { headers });
      if (camRes.ok) {
        const camData = await camRes.json();
        setCamDraft(camData);
      }

      const ratRes = await fetch(`/api/v1/applications/${id}/ratios`, { headers });
      const ratData = await ratRes.json();
      setRatios(ratData.ratios || []);

      const discRes = await fetch(`/api/v1/applications/${id}/discrepancies`, { headers });
      const discData = await discRes.json();
      setDiscrepancies(discData.discrepancies || []);

      const cmtRes = await fetch(`/api/v1/applications/${id}/comments`, { headers });
      const cmtData = await cmtRes.json();
      setComments(cmtData.comments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnComment) return;
    setReturning(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      await fetch(`/api/v1/applications/${id}/review-actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          actionType: 'return',
          comments: returnComment,
        }),
      });
      setShowReturnModal(false);
      navigate('/credit');
    } catch (err) {
      console.error(err);
    } finally {
      setReturning(false);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeComment) return;
    setCompleting(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      await fetch(`/api/v1/applications/${id}/review-actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          actionType: 'complete',
          comments: completeComment,
          losReference,
        }),
      });
      setShowCompleteModal(false);
      navigate('/credit');
    } catch (err) {
      console.error(err);
    } finally {
      setCompleting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const token = localStorage.getItem('kestrel_token');
      await fetch(`/api/v1/applications/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          content: newComment,
          mentions: ['@analyst.demo'],
        }),
      });
      setNewComment('');
      loadReviewData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !application) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center text-xs text-on-surface-variant">
          Loading credit review workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
      <AppHeader />

      {/* Top Review Bar */}
      <div className="bg-white border-b border-[#cbd5e1] px-4 md:px-6 py-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/credit')}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-on-surface">{application.business_name}</h1>
              <span className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded text-on-surface-variant">
                {application.application_number}
              </span>
              <StatusBadge status={application.status} />
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Facility: <strong className="text-on-surface">${application.loan_amount.toLocaleString('en-US')}</strong> • {application.loan_product}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setShowReturnModal(true)}
            className="px-3.5 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">reply</span>
            <span>Return for Correction</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCompleteModal(true)}
            className="px-4 py-1.5 rounded-lg bg-primary hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">task_alt</span>
            <span>Complete Review (Export to LOS)</span>
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-5 flex flex-col gap-5">
        {/* Persistent Non-Credit Decision Disclaimer */}
        <div className="w-full bg-[#f8fafc] border-l-4 border-primary border-y border-r border-[#cbd5e1] p-3 rounded-r-xl flex items-center justify-between gap-3 text-xs text-on-surface shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px] shrink-0">shield_person</span>
            <div>
              <strong className="text-primary font-bold">NOT A CREDIT DECISION. </strong>
              <span className="text-on-surface-variant">
                Copilot assists in evidence synthesis and ratio appraisal. Formal loan approval or rejection is conducted solely in the production LOS by authorized Credit Committees.
              </span>
            </div>
          </div>
          <span className="bg-primary text-white px-2.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase shrink-0">
            Manual LOS Action
          </span>
        </div>

        {/* 2-Column Review Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (7 Cols): CAM & Grounded Evidence */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">article</span>
                  <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Credit Appraisal Memo</h2>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Analyst Verified & Grounded
                </span>
              </div>

              {camDraft ? (
                <div className="flex flex-col gap-4">
                  {camDraft.sections.map((section: any) => (
                    <div key={section.id} className="flex flex-col gap-1.5">
                      <h3 className="text-xs font-bold text-primary">{section.section_title}</h3>
                      <p className="text-xs text-on-surface leading-relaxed font-sans bg-[#f8fafc] p-3 rounded-lg border border-[#e2e8f0]">
                        {section.content_text}
                      </p>
                    </div>
                  ))}

                  {/* Evidence Citations Footnotes */}
                  <div className="pt-3 border-t border-[#e2e8f0] flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Grounding Citations & Source Evidence Trail
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {camDraft.citations.map((cit: any) => (
                        <button
                          key={cit.id}
                          onClick={() => setActiveCitation(cit)}
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-[11px] font-mono flex items-center gap-1 transition-colors"
                        >
                          <span className="font-bold">{cit.marker}</span>
                          <span className="truncate max-w-[150px]">{cit.source_excerpt}</span>
                          <span className="material-symbols-outlined text-[12px]">visibility</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-on-surface-variant">
                  No CAM submitted for review.
                </div>
              )}
            </div>

            {/* Verification Timeline & Audit Signatures */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Verification Timeline & Audit Signatures
              </h3>

              {camDraft?.signoff ? (
                <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/60 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-900">Analyst Verification Sign-Off</span>
                    <span className="text-[10px] font-mono text-emerald-700">{camDraft.signoff.signed_at}</span>
                  </div>
                  <p className="text-xs text-emerald-900 italic">"{camDraft.signoff.signoff_statement}"</p>
                  <div className="flex items-center justify-between pt-1 border-t border-emerald-200 text-[10px] font-mono text-emerald-800">
                    <span>Cryptographic Audit Stamp:</span>
                    <span className="font-bold truncate max-w-xs">{camDraft.signoff.audit_hash}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  Verification sign-off pending from Credit Analyst.
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 Cols): Risk Flags, Ratios & Comments */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Deterministic Financial Summary */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Financial Ratio Scorecard</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {ratios.map((r) => (
                  <div key={r.id} className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-on-surface-variant font-medium truncate">{r.label}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <span className="text-base font-bold text-primary tnum">{r.value}</span>
                    <span className="text-[9px] text-slate-500 font-mono">{r.benchmark}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Flags & Discrepancies */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Risk Flags & Discrepancies</h3>
                <span className="text-xs font-mono text-on-surface-variant">{discrepancies.length} Recorded</span>
              </div>

              {discrepancies.map((d) => (
                <div key={d.id} className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-on-surface">{d.title}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">{d.description}</p>
                  {d.resolution_notes && (
                    <div className="bg-white p-2 rounded border border-[#cbd5e1] text-[10px] text-slate-700">
                      <strong>Analyst Resolution:</strong> {d.resolution_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Threaded Communication with Analyst */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Threaded Analyst Communication
              </h3>

              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto text-xs">
                {comments.length === 0 ? (
                  <span className="text-xs text-on-surface-variant py-2">No comments posted yet.</span>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex flex-col gap-0.5">
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span className="text-primary">{c.author_name} ({c.author_role.toUpperCase()})</span>
                        <span className="text-slate-400 font-mono text-[9px]">{c.created_at}</span>
                      </div>
                      <p className="text-slate-700">{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2 pt-1 border-t border-[#e2e8f0]">
                <input
                  type="text"
                  placeholder="Post comment or question with @analyst.demo..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-bold shadow-xs hover:bg-[#005a54] disabled:opacity-40"
                >
                  Post
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Return for Correction Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleReturnSubmit}
            className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl flex flex-col gap-4 border border-[#cbd5e1]"
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2 text-red-700">
              <h3 className="text-sm font-bold text-on-surface">Return File to Credit Analyst</h3>
              <span className="material-symbols-outlined text-[20px]">reply</span>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              State the specific document, missing reconciliation proof, or ratio spreading discrepancy requiring analyst correction.
            </p>

            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">
                Mandatory Return Comment
              </label>
              <textarea
                rows={3}
                placeholder="Explain the required correction for the analyst..."
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2 text-xs text-on-surface"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[#cbd5e1] text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={returning || returnComment.length < 5}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs disabled:opacity-40"
              >
                {returning ? 'Returning...' : 'Return File for Rework'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Complete Review Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCompleteSubmit}
            className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl flex flex-col gap-4 border border-[#cbd5e1]"
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2 text-primary">
              <h3 className="text-sm font-bold text-on-surface">Complete Credit Appraisal Review</h3>
              <span className="material-symbols-outlined text-[20px]">task_alt</span>
            </div>

            <div className="bg-[#f8fafc] border border-[#cbd5e1] p-3 rounded-lg text-xs flex flex-col gap-1">
              <span className="font-bold text-primary">Manual LOS Handoff Step:</span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Completing this review records formal concurrence on the verified CAM. Formal sanction execution is a manual committee action in the core LOS.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">
                LOS Reference ID (Optional)
              </label>
              <input
                type="text"
                value={losReference}
                onChange={(e) => setLosReference(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2 text-xs font-mono font-bold text-on-surface"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">
                Concurrence Review Summary
              </label>
              <textarea
                rows={3}
                value={completeComment}
                onChange={(e) => setCompleteComment(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2 text-xs text-on-surface"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[#cbd5e1] text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={completing}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-slate-800 text-white text-xs font-bold shadow-xs disabled:opacity-40"
              >
                {completing ? 'Completing...' : 'Confirm Review Completion'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Citation Popover Modal */}
      {activeCitation && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-xl flex flex-col gap-3 border border-[#cbd5e1]">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
              <span className="font-bold text-xs font-mono text-primary">Evidence Citation {activeCitation.marker}</span>
              <button onClick={() => setActiveCitation(null)} className="text-xs font-bold text-slate-500 hover:text-black">✕</button>
            </div>
            <p className="text-xs text-slate-700 bg-[#f8fafc] p-3 rounded-lg border border-[#e2e8f0] font-sans">
              "{activeCitation.source_excerpt}"
            </p>
            <span className="text-[10px] text-slate-500 font-mono">
              Source Page: {activeCitation.source_page || 1} • Entity: {activeCitation.entity_type}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
