import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import StatusBadge from '../../components/StatusBadge';

export default function RmApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'checklist' | 'documents' | 'followups' | 'timeline'>('checklist');

  // Upload state
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<any>(null);

  // Follow-up state
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftRecipient, setDraftRecipient] = useState('');
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [confirmExclusions, setConfirmExclusions] = useState(false);
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const [followupFeedback, setFollowupFeedback] = useState<{ error?: boolean; message?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Timeline
  const [timeline, setTimeline] = useState<any[]>([]);

  useEffect(() => {
    fetchDetail();
    fetchTimeline();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/applications/${id}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      setData(json);

      // Prepopulate latest follow-up if existing
      if (json.followups && json.followups.length > 0) {
        const latest = json.followups[0];
        setActiveDraftId(latest.id);
        setDraftSubject(latest.subject);
        setDraftBody(latest.body_text);
        setDraftRecipient(latest.recipient_email);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/audit-events?entityType=application`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      setTimeline(json.events || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (checklistKey: string, file: File) => {
    setUploadingItem(checklistKey);
    setUploadFeedback(null);
    try {
      const token = localStorage.getItem('kestrel_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('checklistKey', checklistKey);

      const res = await fetch(`/api/v1/applications/${id}/documents`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      const result = await res.json();
      setUploadFeedback(result);
      await fetchDetail();
      await fetchTimeline();
    } catch (err: any) {
      setUploadFeedback({ error: true, message: err.message || 'Upload failed' });
    } finally {
      setUploadingItem(null);
    }
  };

  const handleGenerateFollowup = async () => {
    setGeneratingDraft(true);
    setFollowupFeedback(null);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/applications/${id}/follow-up-drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to synthesize draft' }));
        throw new Error(err.message || err.error || `Server error (HTTP ${res.status})`);
      }

      const draft = await res.json();
      setActiveDraftId(draft.id);
      setDraftSubject(draft.subject);
      setDraftBody(draft.bodyText);
      setDraftRecipient(draft.recipientEmail);
      setFollowupFeedback({
        error: false,
        message: 'AI Follow-up email draft synthesized successfully via Model Gateway!',
      });
      await fetchDetail();
      await fetchTimeline();
    } catch (err: any) {
      console.error(err);
      setFollowupFeedback({
        error: true,
        message: err.message || 'Failed to synthesize follow-up draft. Please try again.',
      });
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleSendFollowup = async () => {
    if (!activeDraftId || !confirmExclusions) return;
    setSendingFollowup(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/follow-up-drafts/${activeDraftId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirmExclusions }),
      });
      if (res.ok) {
        setShowSendModal(false);
        setConfirmExclusions(false);
        setFollowupFeedback({
          error: false,
          message: 'Follow-up email successfully dispatched to borrower and logged in audit timeline!',
        });
        await fetchDetail();
        await fetchTimeline();
      } else {
        const err = await res.json().catch(() => ({ message: 'Dispatch failed' }));
        setFollowupFeedback({ error: true, message: err.message || 'Dispatch failed' });
      }
    } catch (err: any) {
      console.error(err);
      setFollowupFeedback({ error: true, message: err.message || 'Failed to send follow-up' });
    } finally {
      setSendingFollowup(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`Subject: ${draftSubject}\n\n${draftBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openDocument = async (docId: string) => {
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/documents/${docId}/access-link`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const link = await res.json();
      window.open(link.accessUrl, '_blank');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-on-surface-variant font-medium">Loading application dossier...</span>
          </div>
        </div>
      </div>
    );
  }

  const { application, checklist = [], documents = [], followups = [] } = data;
  const missingChecklistItems = checklist.filter((i: any) => i.status === 'missing' || i.status === 'invalid' || i.status === 'expired');

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-5">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button
              onClick={() => navigate('/rm')}
              className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Pipeline
            </button>
            <span>/</span>
            <span className="font-semibold text-slate-900">{application.application_number}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Facility:</span>
            <span className="text-xs font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200">
              ${application.loan_amount.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        {/* Compact Clean Header Hero Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">apartment</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900">{application.business_name}</h1>
                <StatusBadge status={application.status} />
                {application.pilotScopeFlag && (
                  <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Pilot Scope
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                <span>App: <strong>{application.application_number}</strong></span>
                <span>•</span>
                <span>Constitution: <strong>{application.entity_type}</strong></span>
                <span>•</span>
                <span>Facility: <strong>{application.loan_product}</strong></span>
              </div>
            </div>
          </div>

          {/* Completeness Bar */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl self-stretch md:self-auto justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium">Checklist Intake</span>
              <span className="text-xs font-bold text-slate-800">
                {Math.round((application.completeness_score || 0) * 100)}% Complete
              </span>
            </div>
            <div className="w-24 bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  application.completeness_score >= 1.0 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.round((application.completeness_score || 0) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Uncluttered Modern Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
          {[
            { key: 'checklist', label: `Checklist (${checklist.length})`, icon: 'checklist' },
            { key: 'followups', label: `Borrower Follow-ups (${followups.length})`, icon: 'mail' },
            { key: 'documents', label: `Uploaded Files (${documents.length})`, icon: 'description' },
            { key: 'overview', label: 'Borrower Profile', icon: 'info' },
            { key: 'timeline', label: `Audit Trail (${timeline.length})`, icon: 'history' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: CHECKLIST */}
        {activeTab === 'checklist' && (
          <div className="flex flex-col gap-4">
            {/* Quick Action Prompt if Missing Items Exist */}
            {missingChecklistItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-600 text-[22px]">warning</span>
                  <div>
                    <h3 className="text-xs font-bold text-amber-900">
                      {missingChecklistItems.length} Required Document(s) Outstanding
                    </h3>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Need documentation from the borrower? Generate a personalized follow-up reminder email via the AI Gateway.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('followups');
                    handleGenerateFollowup();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                  <span>Draft Follow-Up &rarr;</span>
                </button>
              </div>
            )}

            {/* Upload Feedback */}
            {uploadFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  uploadFeedback.error
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">
                    {uploadFeedback.error ? 'error' : 'check_circle'}
                  </span>
                  <span>{uploadFeedback.message || (uploadFeedback.error ? 'Upload failed' : 'Document uploaded successfully')}</span>
                </div>
                <button
                  onClick={() => setUploadFeedback(null)}
                  className="text-xs font-semibold hover:opacity-75"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Checklist Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Item Key</th>
                    <th className="py-3 px-4">Document Title & Requirements</th>
                    <th className="py-3 px-4">Requirement</th>
                    <th className="py-3 px-4">Verification Status</th>
                    <th className="py-3 px-4 text-right">Upload & Verify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checklist.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-600">{item.item_key}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">{item.label}</span>
                        {item.document_name && (
                          <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                            Attached: {item.document_name}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            item.required ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.required ? 'Mandatory' : 'Optional'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                            item.status === 'valid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'missing'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg transition-colors shadow-2xs">
                          <span className="material-symbols-outlined text-[15px]">upload_file</span>
                          <span>{uploadingItem === item.item_key ? 'Sniffing & Uploading...' : 'Upload'}</span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg"
                            disabled={uploadingItem !== null}
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleFileUpload(item.item_key, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: FOLLOW-UPS (AI DRAFT GENERATOR) */}
        {activeTab === 'followups' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col gap-5">
            {/* Header & Generate Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-600 text-[18px]">forward_to_inbox</span>
                  Borrower Follow-up Communication Hub
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synthesize grounded follow-up reminders via Model Gateway with exclusion confirmations.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateFollowup}
                disabled={generatingDraft}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {generatingDraft ? 'hourglass_top' : 'auto_awesome'}
                </span>
                <span>{generatingDraft ? 'Synthesizing AI Draft...' : 'Generate AI Follow-up Draft'}</span>
              </button>
            </div>

            {/* Feedback Notifications */}
            {followupFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  followupFeedback.error
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">
                    {followupFeedback.error ? 'error' : 'verified'}
                  </span>
                  <span>{followupFeedback.message}</span>
                </div>
                <button
                  onClick={() => setFollowupFeedback(null)}
                  className="text-xs font-semibold hover:opacity-75"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Active Draft Editor & Preview */}
            {activeDraftId ? (
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Active Communication Draft</span>
                    <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      Gateway Synthesized
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-md"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Recipient Borrower Email</label>
                    <input
                      type="email"
                      value={draftRecipient}
                      onChange={(e) => setDraftRecipient(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-teal-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Email Subject Line</label>
                    <input
                      type="text"
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-teal-600 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Communication Body</label>
                  <textarea
                    rows={8}
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 font-sans leading-relaxed focus:outline-teal-600"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-500">
                    Draft ID: <strong className="font-mono text-slate-700">{activeDraftId}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSendModal(true)}
                    className="px-5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    <span>Send Follow-Up to Borrower</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 text-[36px]">drafts</span>
                <p className="text-xs font-semibold text-slate-700">No active follow-up draft.</p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Click the <strong>Generate AI Follow-up Draft</strong> button above to synthesize a customized email reminder based on outstanding checklist items.
                </p>
              </div>
            )}

            {/* Historical Follow-ups Table if multiple */}
            {followups.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Past Follow-up Communications</h3>
                <div className="divide-y divide-slate-100 text-xs">
                  {followups.map((f: any) => (
                    <div key={f.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-semibold text-slate-800 block">{f.subject}</span>
                        <span className="text-[11px] text-slate-500">{f.recipient_email} • {f.created_at}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          f.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {f.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Uploaded Document Dossier</h2>
            {documents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">No documents uploaded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-teal-600 text-[20px]">picture_as_pdf</span>
                      <div>
                        <span className="font-semibold text-slate-900 block">{doc.original_name}</span>
                        <span className="text-[11px] text-slate-500">
                          {doc.mime_type} • {Math.round(doc.file_size_bytes / 1024)} KB • Uploaded {doc.created_at}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => openDocument(doc.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">visibility</span>
                      <span>View File</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col gap-5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Borrower & Facility Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">Business Entity Name</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{application.business_name}</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">Requested Loan Facility</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">${application.loan_amount.toLocaleString('en-US')}</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">Facility Product</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{application.loan_product}</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">Assigned Relationship Manager</span>
                <p className="font-semibold text-slate-900 mt-0.5">Priya Nair (synthetic)</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">Pilot Scope Adherence</span>
                <p className="font-semibold text-emerald-700 mt-0.5">Eligible (&le; $250,000 limit)</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">Current Processing Stage</span>
                <p className="font-semibold text-slate-900 mt-0.5 capitalize">{application.status.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col gap-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Immutable Application Timeline & Audit Trail</h2>
            <div className="flex flex-col gap-3">
              {timeline.map((event: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs">
                  <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{event.action.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{event.timestamp}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                      Actor: {event.actor_role?.toUpperCase()} ({event.actor_id})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Exclusions Confirmation Modal for Follow-up Dispatch */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl flex flex-col gap-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-amber-700">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
              <h3 className="text-base font-bold text-slate-900">Confirm Security Exclusions</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Institutional security policy prohibits collecting customer banking credentials via copilot communications.
            </p>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900 leading-normal">
              <strong>Mandatory Exclusion Confirmation:</strong>
              <p className="mt-1">
                This communication requests only official business documentation and does not solicit banking passwords, PINs, or SMS one-time passwords.
              </p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-800 font-medium pt-1">
              <input
                type="checkbox"
                checked={confirmExclusions}
                onChange={(e) => setConfirmExclusions(e.target.checked)}
                className="accent-teal-700 rounded mt-0.5"
              />
              <span>I confirm that this communication complies with all security credential exclusions.</span>
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmExclusions || sendingFollowup}
                onClick={handleSendFollowup}
                className="px-4 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors shadow-xs disabled:opacity-40"
              >
                {sendingFollowup ? 'Dispatching...' : 'Confirm & Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
