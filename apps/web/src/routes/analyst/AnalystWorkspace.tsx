import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Legend,
  CartesianGrid
} from 'recharts';

export default function AnalystWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [application, setApplication] = useState<any>(null);
  const [extractions, setExtractions] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [ratios, setRatios] = useState<any[]>([]);
  const [camDraft, setCamDraft] = useState<any>(null);
  const [groundingReport, setGroundingReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Active sub-panes
  const [ledgerCategory, setLedgerCategory] = useState<'bank' | 'gst'>('bank');
  const [selectedField, setSelectedField] = useState<any>(null);
  const [rightTab, setRightTab] = useState<'reconciliation' | 'ratios' | 'cam'>('reconciliation');

  // Document Viewer interactive controls (Feature A)
  const [docPage, setDocPage] = useState<number>(1);
  const [docZoom, setDocZoom] = useState<number>(100);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);

  // Edit Field Modal
  const [editingField, setEditingField] = useState<any>(null);
  const [editNewValue, setEditNewValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Discrepancy Resolution Modal
  const [resolvingDiscrepancy, setResolvingDiscrepancy] = useState<any>(null);
  const [resolutionType, setResolutionType] = useState<'explained' | 'corrected' | 'escalated'>('explained');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Formal Sign-off & Submission
  const [signoffStatement, setSignoffStatement] = useState('I hereby certify that all 12-month bank statements and GST filings have been verified against source pages and reconciled per credit policy.');
  const [signing, setSigning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [resolvingGateDiscrepancy, setResolvingGateDiscrepancy] = useState(false);

  const handleSelectField = (field: any) => {
    setSelectedField(field);
    if (field.source_page_number) {
      setDocPage(field.source_page_number);
    }
  };

  const handleVerifySingleField = async (fieldId: string) => {
    try {
      const token = localStorage.getItem('kestrel_token');
      await fetch(`/api/v1/extractions/${fieldId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          newValue: selectedField?.extracted_value || 'Verified',
          reason: 'Verified against source document page and bounding box coordinates.',
        }),
      });
      await loadAllWorkspaceData();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAllWorkspaceData();
  }, [id]);

  const loadAllWorkspaceData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      // 1. Application Detail
      const appRes = await fetch(`/api/v1/applications/${id}`, { headers });
      const appData = await appRes.json();
      setApplication(appData.application);

      // 2. Extractions
      const extRes = await fetch(`/api/v1/applications/${id}/extractions`, { headers });
      const extData = await extRes.json();
      setExtractions(extData.extractions || []);
      if (extData.extractions?.length > 0) {
        setSelectedField(extData.extractions[0]);
      }

      // 3. Reconciliation
      const recRes = await fetch(`/api/v1/applications/${id}/reconciliation`, { headers });
      const recData = await recRes.json();
      setReconciliation(recData.reconciliation);

      // 4. Discrepancies
      const discRes = await fetch(`/api/v1/applications/${id}/discrepancies`, { headers });
      const discData = await discRes.json();
      setDiscrepancies(discData.discrepancies || []);

      // 5. Ratios
      const ratRes = await fetch(`/api/v1/applications/${id}/ratios`, { headers });
      const ratData = await ratRes.json();
      setRatios(ratData.ratios || []);

      // 6. CAM Draft & Grounding
      const camRes = await fetch(`/api/v1/applications/${id}/cam-draft`, { headers });
      if (camRes.ok) {
        const camData = await camRes.json();
        setCamDraft(camData);

        // Grounding check
        const groundRes = await fetch(`/api/v1/cam-drafts/${camData.cam.id}/grounding-check`, { headers });
        if (groundRes.ok) {
          const groundData = await groundRes.json();
          setGroundingReport(groundData.groundingReport);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField || !editReason) return;
    setSavingEdit(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/extractions/${editingField.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          newValue: editNewValue,
          reason: editReason,
        }),
      });
      if (res.ok) {
        setEditingField(null);
        setEditReason('');
        await loadAllWorkspaceData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleBulkVerify = async () => {
    try {
      const token = localStorage.getItem('kestrel_token');
      await fetch(`/api/v1/applications/${id}/verify-bulk`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      await loadAllWorkspaceData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveDiscrepancySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingDiscrepancy || !resolutionNotes) return;
    try {
      const token = localStorage.getItem('kestrel_token');
      await fetch(`/api/v1/discrepancies/${resolvingDiscrepancy.id}/resolutions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          resolutionType,
          notes: resolutionNotes,
        }),
      });
      setResolvingDiscrepancy(null);
      setResolutionNotes('');
      await loadAllWorkspaceData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignoffSubmit = async () => {
    setSigning(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      await fetch(`/api/v1/applications/${id}/verification-signoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ statement: signoffStatement }),
      });
      await loadAllWorkspaceData();
    } catch (err) {
      console.error(err);
    } finally {
      setSigning(false);
    }
  };

  const handleQuickResolveDiscrepancy = async (discrepancyId: string) => {
    setResolvingGateDiscrepancy(true);
    try {
      const token = localStorage.getItem('kestrel_token');
      await fetch(`/api/v1/discrepancies/${discrepancyId}/resolutions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          resolutionType: 'explained',
          notes: 'Reconciled turnover variance against audited operative bank credits and GSTR-3B filings per credit underwriting policy.',
        }),
      });
      await loadAllWorkspaceData();
    } catch (err) {
      console.error(err);
    } finally {
      setResolvingGateDiscrepancy(false);
    }
  };

  const handleSubmitToCredit = async () => {
    if (!camDraft?.cam?.id) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = localStorage.getItem('kestrel_token');
      const res = await fetch(`/api/v1/cam-drafts/${camDraft.cam.id}/submit`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const result = await res.json();
      if (!res.ok) {
        setSubmitError(result.message || 'Submission blocked by gating checks.');
      } else {
        setShowSubmitModal(false);
        navigate('/analyst');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !application) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center text-xs text-on-surface-variant">
          Loading analyst financial workspace...
        </div>
      </div>
    );
  }

  const filteredFields = extractions.filter(f => f.category === ledgerCategory);
  const openMaterialDiscrepancies = discrepancies.filter(d => d.isMaterial && d.status === 'open');
  const isVerificationSigned = Boolean(camDraft?.signoff);
  const isGroundingClean = Boolean(groundingReport?.isValid);
  const canSubmit = isVerificationSigned && openMaterialDiscrepancies.length === 0 && isGroundingClean;

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
      <AppHeader />

      {/* Underwriting Action Bar */}
      <div className="bg-white border-b border-[#cbd5e1] px-4 md:px-6 py-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/analyst')}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-on-surface">{application.business_name}</h1>
            <span className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded text-on-surface-variant">
              {application.application_number}
            </span>
            <span className="font-bold text-xs text-primary tnum">
              ${application.loan_amount.toLocaleString('en-US')}
            </span>
            <StatusBadge status={application.status} />
          </div>
        </div>

        {/* Gated Submission Action */}
        {application.status === 'credit_review' || application.status === 'review_completed' ? (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold shadow-xs">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Submitted to Credit Review Queue</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className={`text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-colors border cursor-pointer ${
                canSubmit
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="Click to review pre-flight gates"
            >
              <span className="material-symbols-outlined text-[14px]">
                {canSubmit ? 'check_circle' : 'lock'}
              </span>
              <span>
                {canSubmit
                  ? '3/3 Pre-Flight Gates Ready'
                  : !isVerificationSigned
                  ? 'Sign-off required (Click to view)'
                  : openMaterialDiscrepancies.length > 0
                  ? `${openMaterialDiscrepancies.length} discrepancy open (Click to view)`
                  : 'Uncited statements (Click to view)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-primary hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              <span>{submitting ? 'Submitting...' : 'Submit to Credit Manager'}</span>
            </button>
          </div>
        )}
      </div>

      {submitError && (
        <div className="mx-4 md:mx-6 mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{submitError}</span>
        </div>
      )}

      {/* Main 3-Pane Responsive Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 md:p-4 overflow-hidden">
        {/* PANE 1: EXTRACTED FINANCIAL LEDGER (3 Cols / 25%) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col overflow-hidden max-h-[85vh]">
          {/* Pane Header */}
          <div className="p-3 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">table_rows</span>
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Financial Ledger</span>
            </div>
            <button
              onClick={handleBulkVerify}
              className="text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors"
            >
              Verify All
            </button>
          </div>

          {/* Sub-Tabs: Bank vs GST */}
          <div className="grid grid-cols-2 gap-1 p-2 bg-[#f1f5f9] border-b border-[#e2e8f0]">
            <button
              onClick={() => setLedgerCategory('bank')}
              className={`py-1 text-xs font-semibold rounded ${
                ledgerCategory === 'bank' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Bank Credits
            </button>
            <button
              onClick={() => setLedgerCategory('gst')}
              className={`py-1 text-xs font-semibold rounded ${
                ledgerCategory === 'gst' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              GST Turnover
            </button>
          </div>

          {/* Fields List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#f1f5f9] text-xs">
            {filteredFields.map((field) => {
              const isSelected = selectedField?.id === field.id;
              const isLowConf = field.confidence_score < 0.85;

              return (
                <div
                  key={field.id}
                  onClick={() => handleSelectField(field)}
                  className={`p-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                    isSelected ? 'bg-blue-50/60 border-l-3 border-primary' : 'hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-bold text-on-surface text-xs truncate">{field.label}</span>
                    <span className="font-bold text-primary tnum text-xs mt-0.5">{field.extracted_value}</span>
                    {field.edited && (
                      <span className="text-[9px] font-bold uppercase text-purple-700 mt-0.5">Manually Edited</span>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                        isLowConf ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {Math.round(field.confidence_score * 100)}%
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingField(field);
                        setEditNewValue(field.extracted_value);
                      }}
                      className="text-[10px] font-semibold text-secondary hover:underline flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-[12px]">edit</span>
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANE 2: SOURCE DOCUMENT & SIMULATED OCR VIEWER (5 Cols / 42%) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col overflow-hidden max-h-[85vh]">
          {/* Header & Interactive Document Toolbar */}
          <div className="p-2.5 border-b border-[#e2e8f0] flex flex-col gap-2 bg-[#f8fafc]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <span className="material-symbols-outlined text-primary text-[18px]">find_in_page</span>
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider truncate">
                  {ledgerCategory === 'bank' ? 'HDFC_Bank_Statement_12M.pdf' : 'GSTR_3B_Consolidated_FY25.pdf'}
                </span>
              </div>
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">
                Simulated OCR • Text Layer
              </span>
            </div>

            {/* Sub-toolbar: Page Switcher, Zoom & Bounding Box Toggle */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 text-xs">
              {/* Page Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDocPage((p) => Math.max(1, p - 1))}
                  disabled={docPage <= 1}
                  className="w-6 h-6 rounded bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  title="Previous Page"
                >
                  <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                </button>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-white rounded border border-slate-200 font-bold text-slate-800">
                  Page {docPage} of 12
                </span>
                <button
                  type="button"
                  onClick={() => setDocPage((p) => Math.min(12, p + 1))}
                  disabled={docPage >= 12}
                  className="w-6 h-6 rounded bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  title="Next Page"
                >
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDocZoom((z) => Math.max(75, z - 15))}
                  className="w-6 h-6 rounded bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                  title="Zoom Out"
                >
                  <span className="material-symbols-outlined text-[14px]">remove</span>
                </button>
                <span className="text-[10px] font-mono font-bold text-slate-600 w-10 text-center">{docZoom}%</span>
                <button
                  type="button"
                  onClick={() => setDocZoom((z) => Math.min(140, z + 15))}
                  className="w-6 h-6 rounded bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                  title="Zoom In"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                </button>
              </div>

              {/* BBox Toggle */}
              <button
                type="button"
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                  showBoundingBoxes
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">
                  {showBoundingBoxes ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <span>BBoxes</span>
              </button>
            </div>
          </div>

          {/* Document Viewer Viewport (Scrollable & Zoom Scalable) */}
          <div className="flex-1 bg-slate-200/80 p-4 overflow-auto flex flex-col items-center">
            <div
              style={{
                transform: `scale(${docZoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease',
              }}
              className="w-full max-w-lg bg-white border border-[#cbd5e1] rounded-lg shadow-md p-5 min-h-[520px] flex flex-col gap-3 font-mono text-xs relative select-none"
            >
              {/* Document Header representation */}
              <div className="border-b-2 border-slate-800 pb-2.5 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 bg-[#004c8f] text-white font-bold flex items-center justify-center text-[10px] rounded-xs">
                      {ledgerCategory === 'bank' ? 'H' : 'G'}
                    </div>
                    <span className="text-xs font-bold text-slate-900 tracking-tight font-sans">
                      {ledgerCategory === 'bank'
                        ? 'HDFC BANK LIMITED — OPERATIVE ACCOUNT'
                        : 'CENTRAL BOARD OF INDIRECT TAXES — FORM GSTR-3B'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1 font-sans">
                    Customer: <strong>{application.business_name}</strong> • Account: <strong>502000889211</strong>
                  </p>
                  <p className="text-[9px] text-slate-500 font-sans">
                    Branch: Fort Mumbai • IFSC: HDFC0000060 • Period Month: {selectedField?.period_month || '2025-10'}
                  </p>
                </div>
                <div className="text-right font-sans text-[10px] text-slate-500">
                  <span className="block font-bold text-slate-700">PAGE {docPage} OF 12</span>
                  <span>ORIGINAL RECORD</span>
                </div>
              </div>

              {/* Document Table Body */}
              {ledgerCategory === 'bank' ? (
                <div className="flex-1 flex flex-col gap-1.5 text-[10px]">
                  {/* Table Headers */}
                  <div className="grid grid-cols-12 gap-1 border-b border-slate-300 pb-1 font-bold text-slate-700 uppercase text-[9px]">
                    <span className="col-span-2">Date</span>
                    <span className="col-span-5">Narration / Ref</span>
                    <span className="col-span-2 text-right">Debit</span>
                    <span className="col-span-3 text-right">Credit / Balance</span>
                  </div>

                  {/* Sample Transaction Rows for active page */}
                  <div className="grid grid-cols-12 gap-1 py-1 text-slate-600 border-b border-dashed border-slate-200">
                    <span className="col-span-2 font-mono">03/{String(docPage).padStart(2, '0')}/25</span>
                    <span className="col-span-5 truncate">ACH/CLIENT SETTLEMENT-REC901</span>
                    <span className="col-span-2 text-right">-</span>
                    <span className="col-span-3 text-right text-emerald-800 font-bold">$12,400.00</span>
                  </div>

                  <div className="grid grid-cols-12 gap-1 py-1 text-slate-600 border-b border-dashed border-slate-200">
                    <span className="col-span-2 font-mono">11/{String(docPage).padStart(2, '0')}/25</span>
                    <span className="col-span-5 truncate">STRIPE/MERCHANT DISBURSEMENT</span>
                    <span className="col-span-2 text-right">-</span>
                    <span className="col-span-3 text-right text-emerald-800 font-bold">$9,250.00</span>
                  </div>

                  <div className="grid grid-cols-12 gap-1 py-1 text-slate-600 border-b border-dashed border-slate-200">
                    <span className="col-span-2 font-mono">18/{String(docPage).padStart(2, '0')}/25</span>
                    <span className="col-span-5 truncate">FEDWIRE/DIRECT TRADE INFLOW</span>
                    <span className="col-span-2 text-right">-</span>
                    <span className="col-span-3 text-right text-emerald-800 font-bold">$14,890.00</span>
                  </div>

                  <div className="grid grid-cols-12 gap-1 py-1 text-slate-600 border-b border-dashed border-slate-200">
                    <span className="col-span-2 font-mono">25/{String(docPage).padStart(2, '0')}/25</span>
                    <span className="col-span-5 truncate">VENDOR PMT/RAW MATERIALS</span>
                    <span className="col-span-2 text-right text-rose-700">$8,500.00</span>
                    <span className="col-span-3 text-right text-slate-500">$27,940.00</span>
                  </div>

                  {/* MONTHLY SUMMARY ROW - BOUNDING BOX OVERLAY */}
                  <div className="relative mt-3 pt-2 border-t-2 border-slate-800">
                    <div className="grid grid-cols-12 gap-1 font-bold text-slate-900 text-xs py-1.5 px-2 bg-slate-50 rounded">
                      <span className="col-span-7 uppercase">TOTAL MONTHLY OPERATIVE CREDITS:</span>
                      <span className="col-span-5 text-right text-primary text-sm font-bold tnum">
                        {selectedField?.extracted_value || '$36,540.00'}
                      </span>
                    </div>

                    {/* LIVE BOUNDING BOX OVERLAY */}
                    {showBoundingBoxes && selectedField && (
                      <div className="absolute -inset-1 border-2 border-amber-500 bg-amber-400/20 rounded ring-2 ring-amber-300/40 pointer-events-none animate-pulse">
                        {/* Corner markers */}
                        <span className="absolute -top-1 -left-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                        <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                        <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-amber-500 rounded-full"></span>

                        {/* Floating BBox Tag Pill */}
                        <div className="absolute -top-6 left-0 bg-amber-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1 whitespace-nowrap">
                          <span>BBOX [{selectedField.boundingBox?.join(', ') || '38, 240, 340, 26'}]</span>
                          <span>• {Math.round(selectedField.confidence_score * 100)}% Conf (Simulated OCR)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* GST RETURN VIEW */
                <div className="flex-1 flex flex-col gap-2 text-[10px]">
                  <div className="bg-slate-100 p-2 rounded text-[10px] font-sans">
                    <span>GSTIN: <strong>27AABCS9912Q1Z4</strong> • Legal Name: <strong>{application.business_name}</strong></span>
                    <span className="block text-slate-500 text-[9px]">Tax Period: Monthly Return (Form GSTR-3B)</span>
                  </div>

                  <span className="font-bold text-slate-800 text-[10px] uppercase pt-1">
                    3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge
                  </span>

                  {/* GST Table */}
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <div className="grid grid-cols-12 gap-1 bg-slate-100 p-1 font-bold text-[9px] text-slate-700 border-b border-slate-300">
                      <span className="col-span-6">Nature of Supplies</span>
                      <span className="col-span-3 text-right">Taxable Value</span>
                      <span className="col-span-3 text-right">IGST / CGST</span>
                    </div>

                    {/* Active Row with BBox */}
                    <div className="relative">
                      <div className="grid grid-cols-12 gap-1 p-2 bg-amber-50/40 font-bold text-[11px] text-slate-900 border-b border-slate-200">
                        <span className="col-span-6">(a) Outward Taxable Supplies:</span>
                        <span className="col-span-3 text-right text-primary tnum">
                          {selectedField?.extracted_value || '$41,200.00'}
                        </span>
                        <span className="col-span-3 text-right text-slate-600 font-mono">$3,296.00</span>
                      </div>

                      {showBoundingBoxes && selectedField && (
                        <div className="absolute -inset-1 border-2 border-amber-500 bg-amber-400/20 rounded ring-2 ring-amber-300/40 pointer-events-none">
                          <span className="absolute -top-1 -left-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                          <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                          <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-amber-500 rounded-full"></span>

                          <div className="absolute -top-6 left-0 bg-amber-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1 whitespace-nowrap">
                            <span>BBOX [{selectedField.boundingBox?.join(', ') || '42, 110, 320, 24'}]</span>
                            <span>• {Math.round(selectedField.confidence_score * 100)}% Conf (Simulated OCR)</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-12 gap-1 p-1.5 text-slate-500 text-[10px] border-b border-slate-200">
                      <span className="col-span-6">(b) Outward Supplies (Zero Rated):</span>
                      <span className="col-span-3 text-right">$0.00</span>
                      <span className="col-span-3 text-right">$0.00</span>
                    </div>

                    <div className="grid grid-cols-12 gap-1 p-1.5 text-slate-500 text-[10px]">
                      <span className="col-span-6">(c) Other Outward Supplies (Nil/Exempt):</span>
                      <span className="col-span-3 text-right">$0.00</span>
                      <span className="col-span-3 text-right">$0.00</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Document footer certificate */}
              <div className="mt-auto border-t border-slate-200 pt-2 flex items-center justify-between text-[9px] text-slate-400 font-sans">
                <span>Certified Electronic Extraction Hash: SHA-256 (Simulated OCR Engine)</span>
                <span>Page {docPage} of 12</span>
              </div>
            </div>
          </div>

          {/* Underwriting Inspection & Field Action Bar */}
          {selectedField && (
            <div className="p-3 bg-[#f8fafc] border-t border-[#e2e8f0] flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{selectedField.label}</span>
                  <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                    {selectedField.field_key}
                  </span>
                  {selectedField.verified && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                      Verified
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleVerifySingleField(selectedField.id)}
                    className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px]">check</span>
                    <span>Verify Field</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingField(selectedField);
                      setEditNewValue(selectedField.extracted_value);
                    }}
                    className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-200 text-slate-800 font-bold text-[10px] shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px]">edit</span>
                    <span>Edit Value</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Value: <strong className="text-primary">{selectedField.extracted_value}</strong></span>
                <span>Confidence: <strong>{Math.round(selectedField.confidence_score * 100)}%</strong></span>
                <span>Page: <strong>{selectedField.source_page_number || docPage}</strong></span>
                <span>BBox: <strong>[{selectedField.boundingBox?.join(', ') || '38, 240, 340, 26'}]</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* PANE 3: MULTITOOL APPRAISAL WORKBENCH (4 Cols / 33%) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col overflow-hidden max-h-[85vh]">
          {/* Sub-Tabs: Reconciliation vs Ratios vs CAM */}
          <div className="grid grid-cols-3 gap-1 p-2 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <button
              onClick={() => setRightTab('reconciliation')}
              className={`py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1 ${
                rightTab === 'reconciliation' ? 'bg-white text-primary shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Reconcile</span>
              {openMaterialDiscrepancies.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              )}
            </button>

            <button
              onClick={() => setRightTab('ratios')}
              className={`py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1 ${
                rightTab === 'ratios' ? 'bg-white text-primary shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Ratios</span>
            </button>

            <button
              onClick={() => setRightTab('cam')}
              className={`py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1 ${
                rightTab === 'cam' ? 'bg-white text-primary shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>CAM & Sign</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
            {/* SUBTAB 1: RECONCILIATION */}
            {rightTab === 'reconciliation' && reconciliation && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Bank vs GST Turnover</h3>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      reconciliation.isReconciled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {reconciliation.isReconciled ? 'Reconciled within 10%' : 'Variance Breached'}
                  </span>
                </div>

                {/* Variance Metrics */}
                <div className="grid grid-cols-2 gap-2 bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0]">
                  <div>
                    <span className="text-[10px] text-on-surface-variant">12M Bank Deposits</span>
                    <p className="font-bold text-on-surface text-sm tnum">
                      ${reconciliation.totalBankCredits.toLocaleString('en-US')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant">12M Sales Tax Turnover</span>
                    <p className="font-bold text-on-surface text-sm tnum">
                      ${reconciliation.totalGstTurnover.toLocaleString('en-US')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant">Net Gap (Bank - Sales Tax)</span>
                    <p className={`font-bold text-sm tnum ${reconciliation.netGap > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      ${reconciliation.netGap.toLocaleString('en-US')} ({reconciliation.netGapPercentage}%)
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant">Policy Tolerance</span>
                    <p className="font-bold text-on-surface text-sm tnum">±{reconciliation.tolerancePercentage}%</p>
                  </div>
                </div>

                {/* Reconciliation Comparison Chart */}
                <div className="h-44 w-full bg-[#f8fafc] rounded-xl p-2 border border-[#e2e8f0]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reconciliation.rows.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Bar dataKey="bankCredits" name="Bank Credits" fill="#1d4ed8" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="gstTurnover" name="GST Turnover" fill="#0f766e" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Discrepancies Resolution Section */}
                <div className="flex flex-col gap-2 pt-2 border-t border-[#e2e8f0]">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Identified Discrepancies</h4>
                  {discrepancies.length === 0 ? (
                    <span className="text-xs text-on-surface-variant">No discrepancies recorded.</span>
                  ) : (
                    discrepancies.map((disc) => (
                      <div key={disc.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-amber-900">{disc.title}</span>
                          <StatusBadge status={disc.status} />
                        </div>
                        <p className="text-[11px] text-amber-800 leading-snug">{disc.description}</p>
                        {disc.resolution_notes && (
                          <div className="bg-white p-2 rounded border border-amber-200 text-[10px] text-slate-700 mt-1">
                            <strong>Resolution Rationale:</strong> {disc.resolution_notes}
                          </div>
                        )}
                        {disc.status === 'open' && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingDiscrepancy(disc);
                                setResolutionType('explained');
                              }}
                              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold"
                            >
                              Resolve Discrepancy
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SUBTAB 2: RATIOS & SPREADING */}
            {rightTab === 'ratios' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Deterministic Financial Ratios</h3>
                  <span className="text-[10px] font-mono text-on-surface-variant">Pure TypeScript Rules</span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {ratios.map((ratio) => (
                    <div key={ratio.id} className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-on-surface">{ratio.label}</span>
                        <StatusBadge status={ratio.status} />
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-primary tnum">{ratio.value}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Benchmark: {ratio.benchmark}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-600 bg-white p-1 rounded border border-[#e2e8f0]">
                        Formula: {ratio.formula}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUBTAB 3: CAM DRAFT & SIGNOFF */}
            {rightTab === 'cam' && camDraft && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Credit Appraisal Memo (CAM)</h3>
                  <StatusBadge status={camDraft.cam.status} />
                </div>

                {/* Grounding Checker Banner */}
                {groundingReport && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 ${
                      groundingReport.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-[16px]">
                        {groundingReport.isValid ? 'verified' : 'warning'}
                      </span>
                      <span>
                        {groundingReport.isValid
                          ? '100% Grounded: All sentences cite verified sources'
                          : `${groundingReport.uncitedSentenceCount} Uncited Sentence(s) Detected`}
                      </span>
                    </div>
                    {!groundingReport.isValid && (
                      <p className="text-[10px] leading-tight text-red-700">
                        Every factual assertion must reference a citation [e.g. [1]] to pass submission gates.
                      </p>
                    )}
                  </div>
                )}

                {/* CAM Sections */}
                <div className="flex flex-col gap-3">
                  {camDraft.sections.map((sec: any) => (
                    <div key={sec.id} className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex flex-col gap-1.5">
                      <span className="font-bold text-xs text-primary">{sec.section_title}</span>
                      <p className="text-xs text-on-surface leading-relaxed font-sans">{sec.content_text}</p>
                    </div>
                  ))}
                </div>

                {/* Formal Verification Sign-Off */}
                <div className="p-3.5 rounded-xl border border-[#cbd5e1] bg-white flex flex-col gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">draw</span>
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                      Formal Verification Sign-Off
                    </span>
                  </div>

                  {camDraft.signoff ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex flex-col gap-1 text-[11px] text-emerald-900">
                      <div className="flex items-center justify-between font-bold">
                        <span>Signed by Analyst</span>
                        <span className="font-mono">{camDraft.signoff.signed_at}</span>
                      </div>
                      <p className="text-[10px] italic">"{camDraft.signoff.signoff_statement}"</p>
                      <span className="text-[9px] font-mono text-emerald-700 truncate">
                        Audit Hash: {camDraft.signoff.audit_hash}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <textarea
                        rows={2}
                        value={signoffStatement}
                        onChange={(e) => setSignoffStatement(e.target.value)}
                        className="w-full text-xs p-2 border border-[#cbd5e1] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleSignoffSubmit}
                        disabled={signing}
                        className="w-full py-1.5 rounded-lg bg-secondary text-white text-xs font-bold shadow-xs hover:bg-[#005a54] transition-colors disabled:opacity-50"
                      >
                        {signing ? 'Signing...' : 'Sign Verification & Stamp Audit Hash'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Extraction Field Modal */}
      {editingField && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleEditFieldSubmit}
            className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl flex flex-col gap-4 border border-[#cbd5e1]"
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
              <h3 className="text-sm font-bold text-on-surface">Edit Extracted Value</h3>
              <span className="text-xs font-mono text-on-surface-variant">{editingField.field_key}</span>
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">New Underwritten Value</label>
              <input
                type="text"
                value={editNewValue}
                onChange={(e) => setEditNewValue(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2 text-xs font-bold text-on-surface"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">
                Mandatory Underwriting Reason (Logged in Immutable Audit Trail)
              </label>
              <textarea
                rows={3}
                placeholder="Explain why the automated extraction requires manual alteration..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2 text-xs text-on-surface"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="px-3 py-1.5 rounded-lg border border-[#cbd5e1] text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit || editReason.length < 5}
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold shadow-xs hover:bg-slate-800 disabled:opacity-40"
              >
                {savingEdit ? 'Recording...' : 'Save & Record Audit History'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Discrepancy Resolution Modal */}
      {resolvingDiscrepancy && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleResolveDiscrepancySubmit}
            className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl flex flex-col gap-4 border border-[#cbd5e1]"
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
              <h3 className="text-sm font-bold text-on-surface">Resolve Discrepancy</h3>
              <StatusBadge status={resolvingDiscrepancy.status} />
            </div>

            <div className="text-xs text-slate-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              {resolvingDiscrepancy.title}: {resolvingDiscrepancy.description}
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">Resolution Action</label>
              <select
                value={resolutionType}
                onChange={(e) => setResolutionType(e.target.value as any)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2 text-xs font-semibold text-on-surface"
              >
                <option value="explained">Explained (Justified operational difference)</option>
                <option value="corrected">Corrected (Ledger adjusted against source)</option>
                <option value="escalated">Escalated (Referred to Credit Manager)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1">
                Detailed Resolution Rationale
              </label>
              <textarea
                rows={3}
                placeholder="State the underlying business rationale or invoice reconciliation findings..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2 text-xs text-on-surface"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setResolvingDiscrepancy(null)}
                className="px-3 py-1.5 rounded-lg border border-[#cbd5e1] text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resolutionNotes.length < 5}
                className="px-4 py-1.5 rounded-lg bg-secondary text-white text-xs font-bold shadow-xs hover:bg-[#005a54] disabled:opacity-40"
              >
                Resolve & Update Status
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pre-Flight Underwriting Submission Checklist Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-4 border border-[#cbd5e1]">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <div>
                <h3 className="text-sm font-bold text-on-surface">Underwriter Pre-Flight & Gated Submission</h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Transferring <span className="font-semibold text-primary">{application.business_name}</span> to Credit Manager Review Queue
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {submitError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{submitError}</span>
              </div>
            )}

            {/* Checklist items */}
            <div className="flex flex-col gap-3">
              {/* Gate 1: Reconciliation Discrepancies */}
              <div className={`p-3 rounded-xl border flex flex-col gap-2 ${
                openMaterialDiscrepancies.length === 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/70 border-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[18px] ${
                      openMaterialDiscrepancies.length === 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {openMaterialDiscrepancies.length === 0 ? 'check_circle' : 'warning'}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      Gate 1: Material Discrepancies ({openMaterialDiscrepancies.length} Open)
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    openMaterialDiscrepancies.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {openMaterialDiscrepancies.length === 0 ? 'PASSED' : 'ACTION REQUIRED'}
                  </span>
                </div>

                {openMaterialDiscrepancies.length === 0 ? (
                  <p className="text-[11px] text-emerald-800">
                    All bank credit vs GST turnover variances are within tolerance or resolved with verified rationale.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 pt-1 border-t border-amber-200/60">
                    {openMaterialDiscrepancies.map((disc) => (
                      <div key={disc.id} className="flex items-center justify-between text-[11px] text-slate-700 bg-white/80 p-2 rounded border border-amber-200">
                        <span className="truncate max-w-[260px] font-medium">{disc.title}</span>
                        <button
                          type="button"
                          onClick={() => handleQuickResolveDiscrepancy(disc.id)}
                          disabled={resolvingGateDiscrepancy}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {resolvingGateDiscrepancy ? 'Resolving...' : 'Quick Resolve'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Gate 2: CAM Grounding Verification */}
              <div className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                isGroundingClean ? 'bg-emerald-50/60 border-emerald-200' : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[18px] ${
                      isGroundingClean ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      {isGroundingClean ? 'check_circle' : 'cancel'}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      Gate 2: CAM Grounding Verification
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isGroundingClean ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {isGroundingClean ? '100% GROUNDED' : 'UNCITED ASSERTIONS'}
                  </span>
                </div>
                <p className={`text-[11px] ${isGroundingClean ? 'text-emerald-800' : 'text-red-700'}`}>
                  {isGroundingClean
                    ? 'All narrative statements in the Credit Appraisal Memo reference valid citations.'
                    : `${groundingReport?.uncitedSentenceCount || 1} uncited assertion(s) detected. Every factual statement must reference citations.`}
                </p>
              </div>

              {/* Gate 3: Formal Analyst Sign-Off */}
              <div className={`p-3 rounded-xl border flex flex-col gap-2 ${
                isVerificationSigned ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/70 border-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[18px] ${
                      isVerificationSigned ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {isVerificationSigned ? 'check_circle' : 'draw'}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      Gate 3: Formal Verification Sign-Off
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isVerificationSigned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isVerificationSigned ? 'SIGNED & STAMPED' : 'SIGNATURE REQUIRED'}
                  </span>
                </div>

                {isVerificationSigned ? (
                  <div className="text-[11px] text-emerald-900 bg-white/80 p-2 rounded border border-emerald-200 flex flex-col gap-0.5">
                    <span className="font-semibold italic">"{camDraft?.signoff?.signoff_statement}"</span>
                    <span className="font-mono text-[9px] text-emerald-700 truncate">
                      Audit Hash: {camDraft?.signoff?.audit_hash}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pt-1 border-t border-amber-200/60">
                    <textarea
                      rows={2}
                      value={signoffStatement}
                      onChange={(e) => setSignoffStatement(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-[#cbd5e1] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleSignoffSubmit}
                      disabled={signing}
                      className="w-full py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">draw</span>
                      <span>{signing ? 'Signing...' : 'Sign Verification & Stamp Audit Hash'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-lg border border-[#cbd5e1] text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={handleSubmitToCredit}
                className="px-5 py-2 rounded-lg bg-primary hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>{submitting ? 'Submitting to Credit...' : 'Confirm & Submit to Credit Manager'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
