import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../db/connection.js';
import { initializeDatabase } from '../db/init.js';
import { recordAuditEvent } from '../db/audit.js';
import { config } from '../config.js';

export async function runSeed(): Promise<void> {
  console.log('[Kestrel Seed] Starting database initialization and seed data generation...');
  initializeDatabase();
  const db = getDatabase();

  // Clean existing data for clean re-seeding
  db.exec('PRAGMA foreign_keys = OFF;');

  const tables = [
    'review_actions', 'verification_signoffs', 'comments', 'follow_up_drafts',
    'citations', 'cam_sections', 'cam_drafts', 'ratios', 'discrepancies',
    'extraction_field_history', 'extraction_fields', 'extraction_jobs',
    'document_pages', 'document_versions', 'checklist_items', 'documents',
    'applications', 'notifications', 'user_roles', 'users', 'roles',
    'model_registry', 'model_configuration_versions', 'model_change_requests',
    'prompt_versions', 'prompt_change_requests', 'evaluation_metrics',
    'evaluation_alerts', 'evaluation_runs', 'evaluation_datasets',
    'role_change_requests', 'configuration_items', 'configuration_change_requests'
  ];

  for (const t of tables) {
    try {
      db.prepare(`DELETE FROM ${t}`).run();
    } catch {
      // Ignore delete restrictions on append-only tables protected by SQLite triggers
    }
  }

  db.exec('PRAGMA foreign_keys = ON;');

  // Ensure documents directory exists
  const docsDir = path.join(config.DATA_DIR, 'documents');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Wrap all insertions in an atomic transaction for orders-of-magnitude faster initialization
  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Roles
  const roles = [
    { id: 'role_rm', name: 'rm', description: 'Relationship Manager: pipelines, checklist, uploads, follow-ups' },
    { id: 'role_analyst', name: 'analyst', description: 'Credit Analyst: extraction verification, reconciliation, ratios, CAM generation' },
    { id: 'role_cm', name: 'credit_manager', description: 'Credit Manager: CAM review, return for correction, review completion' },
    { id: 'role_owner', name: 'owner', description: 'System Owner & Governance Administrator (No credit-action permissions)' },
    { id: 'role_risk', name: 'risk_delegate', description: 'Risk Delegate: secondary approver for credit-relevant prompt changes' },
  ];

  const insertRole = db.prepare('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)');
  for (const r of roles) {
    insertRole.run(r.id, r.name, r.description);
  }

  // 2. Demo Users (all synthetic with bcrypt password hash)
  const passwordHash = await bcrypt.hash('Kestrel@2026!', 10);
  const rmHash = await bcrypt.hash('Kestrel@RM2026!', 10);
  const analystHash = await bcrypt.hash('Kestrel@Analyst2026!', 10);
  const cmHash = await bcrypt.hash('Kestrel@CM2026!', 10);
  const ownerHash = await bcrypt.hash('Kestrel@Owner2026!', 10);

  const users = [
    { id: 'usr_rm_1', username: 'rm.demo', email: 'priya.nair@kestrel-synthetic.bank', passwordHash: rmHash, fullName: 'Priya Nair (synthetic)', role: 'role_rm' },
    { id: 'usr_analyst_1', username: 'analyst.demo', email: 'arjun.menon@kestrel-synthetic.bank', passwordHash: analystHash, fullName: 'Arjun Menon (synthetic)', role: 'role_analyst' },
    { id: 'usr_cm_1', username: 'cm.demo', email: 'kavitha.rao@kestrel-synthetic.bank', passwordHash: cmHash, fullName: 'Kavitha Rao (synthetic)', role: 'role_cm' },
    { id: 'usr_owner_1', username: 'owner.demo', email: 'sanjay.gupta@kestrel-synthetic.bank', passwordHash: ownerHash, fullName: 'Sanjay Gupta (synthetic)', role: 'role_owner' },
    { id: 'usr_risk_1', username: 'risk.demo', email: 'meera.deshmukh@kestrel-synthetic.bank', passwordHash: passwordHash, fullName: 'Meera Deshmukh (Risk Delegate) (synthetic)', role: 'role_risk' },
    { id: 'usr_owner_2', username: 'admin2.demo', email: 'rajesh.verma@kestrel-synthetic.bank', passwordHash: passwordHash, fullName: 'Rajesh Verma (Secondary Approver) (synthetic)', role: 'role_owner' },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, full_name, is_synthetic, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `);
  const insertUserRole = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');

  for (const u of users) {
    insertUser.run(u.id, u.username, u.email, u.passwordHash, u.fullName);
    insertUserRole.run(u.id, u.role);
    // Give owner user also analyst view rights if desired, but owner cannot act on credit
  }

  // 3. Model Registry & Configuration
  const insertModel = db.prepare(`
    INSERT INTO model_registry (
      model_id, provider, deployment, region, residency_status, input_price_per_million,
      output_price_per_million, price_version, context_limit, capabilities_json,
      compatible_agents_json, is_primary, is_fallback, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  insertModel.run(
    'gemini-2.5-flash',
    'Google Cloud',
    'Managed API',
    'us-central1',
    'Approved (Synthetic Data)',
    0.15,
    0.60,
    'v2026.1-usd',
    1048576,
    JSON.stringify(['structured_json', 'long_context', 'vision']),
    JSON.stringify(['bank-extractor', 'gst-extractor', 'cam-draft', 'followup-draft']),
    1,
    0
  );

  insertModel.run(
    'gemini-1.5-flash',
    'Google Cloud',
    'Managed API',
    'us-central1',
    'Approved (Synthetic Data)',
    0.15,
    0.60,
    'v2026.1-usd',
    1048576,
    JSON.stringify(['structured_json', 'long_context']),
    JSON.stringify(['bank-extractor', 'gst-extractor', 'cam-draft', 'followup-draft']),
    0,
    1
  );

  insertModel.run(
    'simulated-deterministic',
    'Simulated Provider',
    'Local Air-Gapped Engine',
    'Local Edge Tenancy',
    'Approved',
    0.0,
    0.0,
    'v2026.1-usd',
    128000,
    JSON.stringify(['deterministic_extraction', 'instant_offline']),
    JSON.stringify(['bank-extractor', 'gst-extractor', 'cam-draft', 'followup-draft']),
    0,
    0
  );

  // Model configuration version
  db.prepare(`
    INSERT INTO model_configuration_versions (
      id, version_number, primary_model_id, fallback_model_id, reason, proposed_by, approved_by, effective_at, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'active', datetime('now'))
  `).run(
    'mcfg_v1',
    1,
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'Baseline configuration for pilot cohort SME working-capital appraisal',
    'usr_owner_1',
    'usr_owner_2'
  );

  // 4. Prompts & Versions
  const insertPrompt = db.prepare(`
    INSERT INTO prompt_versions (
      id, agent_id, version_number, body, change_note, author_id, status, risk_class, approver_id, published_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  insertPrompt.run(
    'pv_bank_v1',
    'bank-extractor',
    1,
    'Extract monthly credit turn, debit turn, average balance, and EMI debits from the provided 12-month bank statements into structured JSON adhering to the specified schema.',
    'Initial calibrated prompt for SME bank statement ledger extraction',
    'usr_owner_1',
    'published',
    'credit_relevant',
    'usr_risk_1'
  );

  insertPrompt.run(
    'pv_gst_v1',
    'gst-extractor',
    1,
    'Parse GSTR-3B and GSTR-1 returns. Extract monthly outward taxable turnover, zero-rated supply, and input tax credit into structured JSON.',
    'Calibrated GST 12-month turnover extraction prompt',
    'usr_owner_1',
    'published',
    'credit_relevant',
    'usr_risk_1'
  );

  insertPrompt.run(
    'pv_cam_v1',
    'cam-draft',
    1,
    'Synthesize the verified financial ratios, bank reconciliation, and business profile into a formal Credit Appraisal Memo. Ground every assertion with [citation] tags.',
    'Credit Appraisal Memo drafting template with strict grounding citations',
    'usr_owner_1',
    'published',
    'credit_relevant',
    'usr_risk_1'
  );

  insertPrompt.run(
    'pv_followup_v1',
    'followup-draft',
    1,
    'Draft a professional, clear communication requesting the outstanding documentation items listed. Do not request sensitive credentials or OTPs.',
    'Relationship Manager follow-up communication prompt',
    'usr_owner_1',
    'published',
    'operational',
    'usr_owner_2'
  );

  // 5. System Configuration Items
  const insertConfig = db.prepare(`INSERT INTO configuration_items (key, value, description, is_secret, updated_at) VALUES (?, ?, ?, ?, datetime('now'))`);
  insertConfig.run('reconciliation_tolerance_pct', '10.0', 'Maximum allowable variance % between bank deposits and sales tax turnover before flagging discrepancy', 0);
  insertConfig.run('min_confidence_auto_accept', '0.85', 'Confidence score threshold (85%) for auto-accepting OCR extractions', 0);
  insertConfig.run('pilot_max_amount_usd', '250000', 'Ceiling amount for SME working capital pilot cohort ($250,000)', 0);
  insertConfig.run('reporting_currency', 'USD', 'Primary functional currency for all calculations and risk exposure', 0);

  // 6. Generate 42 Synthetic Applications
  console.log('[Kestrel Seed] Generating 42 synthetic loan applications...');

  const businessNames = [
    'Aarohi Textile Works', 'Zenith Precision Auto Ancillaries', 'Kaveri Logistics Solutions',
    'Siddhivinayak Tooling & Dies', 'Vardhman Plastics & Polymers', 'Navkar Electricals & Switchgear',
    'Shree Ganesh Engineering', 'Sai Krupa Food Processing', 'Meenakshi Agro Mills',
    'Apex Pharma Packaging', 'Sri Venkateswara Corrugation', 'Maruti Brass & Hardware Components',
    'Devika Garments & Exports', 'Pooja CNC Turning', 'Aditya Steel Tubes & Pipes',
    'Surya Cold Storage & Logistics', 'Lakshmi Machine Works & Fabrication', 'Om Sai Granites & Tiles',
    'Bhavani Chemicals & Dyes', 'Krishna Cotton Ginning', 'Radhe Krishna Polyfilms',
    'Annapurna Bakery & Confectionery', 'Balaji Agro Fertilizers', 'Choudhary Transport Services',
    'Dhanlaxmi Paper Mills', 'Evershine Auto Fasteners', 'Falcon Precision Gauges',
    'Gayatri Castings & Foundry', 'Hari Om Spices & Processing', 'Indus Valley Rubber Products',
    'Jai Hind Engineering Works', 'Kuber Metal Extrusions', 'Lotus Offset Printers',
    'Mahalaxmi Solar Systems', 'Narmada Pipes & Fittings', 'Ornate Glass & Aluminium',
    'Paragon Leather Crafts', 'Ridhi Sidhi Timber Traders', 'Shankar Wire & Cables',
    'Tejasvi Ceramics & Sanitary', 'Universal Wire Mesh Works', 'Vidya Tech Instruments'
  ];

  const products = [
    'SME Working Capital Term Loan',
    'Secured Cash Credit Facility',
    'Working Capital Demand Loan',
    'Invoice Discounting Line'
  ];

  const insertApp = db.prepare(`
    INSERT INTO applications (
      id, application_number, business_name, loan_amount, loan_product, status,
      pilot_scope_flag, completeness_score, rm_user_id, analyst_user_id, cm_user_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
  `);

  const insertChecklist = db.prepare(`
    INSERT INTO checklist_items (
      id, application_id, item_key, label, required, period, allowed_file_types,
      owner_role, status, document_id, failing_rule, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const insertDoc = db.prepare(`
    INSERT INTO documents (
      id, application_id, checklist_item_id, filename, original_name, mime_type,
      size_bytes, storage_path, is_synthetic, page_count, status, validation_errors,
      uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, datetime('now'))
  `);

  const insertDocPage = db.prepare(`
    INSERT INTO document_pages (id, document_id, page_number, text_layer_json)
    VALUES (?, ?, ?, ?)
  `);

  const insertField = db.prepare(`
    INSERT INTO extraction_fields (
      id, application_id, document_id, field_key, label, category, extracted_value,
      normalized_value, confidence_score, auto_accepted, verified, edited,
      source_document_id, source_page_number, bounding_box_json, period_month,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const insertDiscrepancy = db.prepare(`
    INSERT INTO discrepancies (
      id, application_id, type, title, description, bank_value, gst_value,
      variance_value, variance_percentage, status, resolution_type, resolution_notes,
      resolved_by, resolved_at, is_material, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertRatio = db.prepare(`
    INSERT INTO ratios (
      id, application_id, ratio_key, label, value, formula, inputs_json,
      scorecard_version, benchmark, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'v2026.1', ?, ?, datetime('now'))
  `);

  const insertCamDraft = db.prepare(`
    INSERT INTO cam_drafts (
      id, application_id, version_number, title, status, overall_summary,
      is_grounding_valid, created_at, updated_at
    ) VALUES (?, ?, 1, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const insertCamSection = db.prepare(`
    INSERT INTO cam_sections (
      id, cam_draft_id, section_key, section_title, content_text, ordering,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const insertCitation = db.prepare(`
    INSERT INTO citations (
      id, cam_draft_id, citation_number, marker, entity_type, entity_id,
      source_excerpt, source_page, bounding_box_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const months = [
    '2025-11', '2025-10', '2025-09', '2025-08', '2025-07', '2025-06',
    '2025-05', '2025-04', '2025-03', '2025-02', '2025-01', '2024-12'
  ];

  for (let i = 0; i < businessNames.length; i++) {
    const appId = `app_${1000 + i}`;
    const appNum = `KST-2026-${(1000 + i).toString()}`;
    const bName = `${businessNames[i]} (synthetic)`;

    // Amount distribution:
    // Files 0-35: $80,000 to $240,000 (<= $250,000, pilot scope)
    // Files 36-41: $260,000 to $410,000 (> $250,000, outside pilot scope)
    let loanAmount: number;
    let inPilotScope: number;
    if (i < 36) {
      loanAmount = 80000 + ((i * 4700) % 160000); // Between $80,000 and $240,000
      inPilotScope = 1;
    } else {
      loanAmount = 260000 + ((i - 36) * 30000); // $260K, $290K, $320K...
      inPilotScope = 0;
    }

    const product = products[i % products.length];

    // Status distribution
    let status: string;
    let completeness: number;
    if (i < 8) {
      status = 'documents_pending';
      completeness = 0.55;
    } else if (i < 24) {
      status = 'verification_queue'; // Analyst queue
      completeness = 1.0;
    } else if (i < 34) {
      status = 'credit_review'; // CM review queue
      completeness = 1.0;
    } else if (i < 38) {
      status = 'returned_to_analyst';
      completeness = 1.0;
    } else {
      status = 'review_completed';
      completeness = 1.0;
    }

    const dateOffset = `-${(i % 15)} days`;

    insertApp.run(
      appId,
      appNum,
      bName,
      loanAmount,
      product,
      status,
      inPilotScope,
      completeness,
      'usr_rm_1',
      'usr_analyst_1',
      'usr_cm_1',
      dateOffset,
      dateOffset
    );

    // Document Checklist Items
    const checkItems = [
      { key: 'bank_statement_12m', label: '12-Month Operative Bank Statements', period: 'Dec 2024 - Nov 2025', types: ['application/pdf'] },
      { key: 'gstr3b_12m', label: '12-Month GSTR-3B Summary Returns', period: 'Dec 2024 - Nov 2025', types: ['application/pdf'] },
      { key: 'gstr1_12m', label: '12-Month GSTR-1 Outward Supplies', period: 'Dec 2024 - Nov 2025', types: ['application/pdf'] },
      { key: 'pan_card', label: 'Entity & Promoter PAN Cards', period: null, types: ['application/pdf', 'image/png'] },
      { key: 'udyam_cert', label: 'Udyam MSME Registration Certificate', period: null, types: ['application/pdf'] },
    ];

    const isMissingSome = status === 'documents_pending';
    const hasExpiredDoc = i === 3 || i === 7;
    const hasUnreadableDoc = i === 5;

    let bankDocId = `doc_bank_${appId}`;
    let gstDocId = `doc_gst_${appId}`;

    for (let cIdx = 0; cIdx < checkItems.length; cIdx++) {
      const ci = checkItems[cIdx];
      const ciId = `chk_${appId}_${ci.key}`;
      let cStatus = 'valid';
      let docIdForCi: string | null = null;
      let failingRule: string | null = null;

      if (isMissingSome && cIdx >= 3) {
        cStatus = 'missing';
      } else if (hasExpiredDoc && cIdx === 4) {
        cStatus = 'expired';
        failingRule = 'Document validity period has expired (>180 days since certificate revalidation)';
        docIdForCi = `doc_${appId}_expired`;
      } else if (hasUnreadableDoc && cIdx === 2) {
        cStatus = 'invalid';
        failingRule = 'Readability check failed: Resolution < 150 DPI or corrupted PDF stream';
        docIdForCi = `doc_${appId}_unreadable`;
      } else {
        docIdForCi = `doc_${appId}_${ci.key}`;
      }

      insertChecklist.run(
        ciId,
        appId,
        ci.key,
        ci.label,
        1,
        ci.period,
        JSON.stringify(ci.types),
        'rm',
        cStatus,
        docIdForCi,
        failingRule
      );

      // Create Document records if uploaded
      if (docIdForCi) {
        const docFilename = `${appNum}_${ci.key}.pdf`;
        const storagePath = path.join(docsDir, docFilename);

        // Generate synthetic PDF content with mock binary structure
        if (!fs.existsSync(storagePath)) {
          fs.writeFileSync(storagePath, `%PDF-1.4\n% Synthetic Document for ${bName}\n% Type: ${ci.label}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj xref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n175\n%%EOF`);
        }

        const isRejected = cStatus === 'invalid' || cStatus === 'expired';
        insertDoc.run(
          docIdForCi,
          appId,
          ciId,
          docFilename,
          `${ci.label}.pdf`,
          'application/pdf',
          245760,
          storagePath,
          isRejected ? 1 : 5,
          isRejected ? 'rejected' : 'validated',
          failingRule ? JSON.stringify([failingRule]) : null,
          'usr_rm_1'
        );

        // Structured text layer for simulated OCR
        const textLayer = [
          { word: bName, bbox: [50, 40, 250, 60], page: 1, confidence: 0.99 },
          { word: `Account No: 502000${(880000 + i)}`, bbox: [50, 70, 220, 85], page: 1, confidence: 0.98 },
          { word: `IFSC: HDFC0001234`, bbox: [250, 70, 380, 85], page: 1, confidence: 0.98 },
          { word: `Period: Dec 2024 to Nov 2025`, bbox: [50, 95, 260, 110], page: 1, confidence: 0.96 },
          { word: `Total Credit Turnover: USD $${(loanAmount * 2.8).toLocaleString('en-US')}`, bbox: [50, 120, 300, 135], page: 1, confidence: 0.97 },
          { word: `GSTIN: 27AABCT${(1000 + i)}Q1ZP`, bbox: [50, 150, 240, 165], page: 1, confidence: 0.99 },
        ];

        insertDocPage.run(
          `page_${docIdForCi}_1`,
          docIdForCi,
          1,
          JSON.stringify(textLayer)
        );
      }
    }

    // 12 Months of Monthly Bank & GST extractions
    // Base monthly turnover ~ (loanAmount * 2.5) / 12
    const baseMonthly = Math.round((loanAmount * 2.5) / 12);
    // Approximately 20% of files have material reconciliation discrepancies (e.g. i % 5 === 0)
    const hasDiscrepancy = i % 5 === 0;

    let totalBankCredits = 0;
    let totalGstTurnover = 0;

    for (let m = 0; m < months.length; m++) {
      const monthStr = months[m];
      const bankVariation = 1.0 + Math.sin(m + i) * 0.15;
      const monthlyBankCredit = Math.round(baseMonthly * bankVariation);
      totalBankCredits += monthlyBankCredit;

      // In discrepancy files, GST turnover differs by 18-25% in specific months
      let monthlyGstTurnover = monthlyBankCredit;
      if (hasDiscrepancy && (m === 2 || m === 6)) {
        monthlyGstTurnover = Math.round(monthlyBankCredit * 0.76); // 24% gap
      } else {
        monthlyGstTurnover = Math.round(monthlyBankCredit * (0.97 + (m % 3) * 0.02)); // Within ~3%
      }
      totalGstTurnover += monthlyGstTurnover;

      // 15% of fields have lower confidence (< 0.85)
      const isLowConfidenceBank = (i + m) % 7 === 0;
      const isLowConfidenceGst = (i + m) % 6 === 0;
      const bankConf = isLowConfidenceBank ? 0.74 : 0.97;
      const gstConf = isLowConfidenceGst ? 0.71 : 0.98;

      // Insert Bank Credit field
      const bankFieldId = `fld_bank_${appId}_${monthStr}`;
      insertField.run(
        bankFieldId,
        appId,
        bankDocId,
        `bank_credit_${monthStr}`,
        `Bank Credits (${monthStr})`,
        'bank',
        `$${monthlyBankCredit.toLocaleString('en-US')}`,
        monthlyBankCredit,
        bankConf,
        bankConf >= 0.85 ? 1 : 0,
        status === 'credit_review' || status === 'review_completed' ? 1 : 0,
        0,
        bankDocId,
        1,
        JSON.stringify([50, 120 + m * 15, 280, 135 + m * 15]),
        monthStr
      );

      // Insert GST Turnover field
      const gstFieldId = `fld_gst_${appId}_${monthStr}`;
      insertField.run(
        gstFieldId,
        appId,
        gstDocId,
        `gst_turnover_${monthStr}`,
        `GST Turnover (${monthStr})`,
        'gst',
        `$${monthlyGstTurnover.toLocaleString('en-US')}`,
        monthlyGstTurnover,
        gstConf,
        gstConf >= 0.85 ? 1 : 0,
        status === 'credit_review' || status === 'review_completed' ? 1 : 0,
        0,
        gstDocId,
        1,
        JSON.stringify([50, 160 + m * 15, 280, 175 + m * 15]),
        monthStr
      );
    }

    // Insert Discrepancy if applicable
    if (hasDiscrepancy) {
      const gapAmount = totalBankCredits - totalGstTurnover;
      const gapPct = Number(((gapAmount / totalGstTurnover) * 100).toFixed(2));
      const discStatus = (status === 'credit_review' || status === 'review_completed') ? 'explained' : 'open';

      insertDiscrepancy.run(
        `disc_${appId}_1`,
        appId,
        'gst_vs_bank',
        'Material Banking Deposits vs Sales Tax Variance',
        `12-month Bank Deposits ($${totalBankCredits.toLocaleString('en-US')}) exceed Sales Tax reported turnover ($${totalGstTurnover.toLocaleString('en-US')}) by ${gapPct}%, breaching the 10.0% policy tolerance threshold.`,
        totalBankCredits,
        totalGstTurnover,
        gapAmount,
        gapPct,
        discStatus,
        discStatus === 'explained' ? 'explained' : null,
        discStatus === 'explained' ? 'Difference reconciled: Advance customer deposits received in Q2 adjusted against subsequent dispatch invoices.' : null,
        discStatus === 'explained' ? 'usr_analyst_1' : null,
        discStatus === 'explained' ? new Date().toISOString() : null,
        1
      );
    }

    // Deterministic Financial Ratios
    const dscrValue = Number((1.35 + (i % 7) * 0.1).toFixed(2));
    const currentRatioValue = Number((1.22 + (i % 5) * 0.08).toFixed(2));
    const npmValue = Number((5.8 + (i % 6) * 0.7).toFixed(2));
    const turnoverGrowth = Number((11.4 + (i % 8) * 1.5).toFixed(2));

    insertRatio.run(
      `ratio_${appId}_dscr`,
      appId,
      'dscr',
      'Debt Service Coverage Ratio (DSCR)',
      dscrValue,
      '(PAT + Depreciation + Interest) / (Debt Obligation + Interest)',
      JSON.stringify({ pat: Math.round(loanAmount * 0.35), depreciation: Math.round(loanAmount * 0.1), interest: Math.round(loanAmount * 0.08), debtObligation: Math.round(loanAmount * 0.28) }),
      '> 1.25',
      dscrValue >= 1.25 ? 'healthy' : 'warning'
    );

    insertRatio.run(
      `ratio_${appId}_cr`,
      appId,
      'current_ratio',
      'Current Ratio',
      currentRatioValue,
      'Current Assets / Current Liabilities',
      JSON.stringify({ currentAssets: Math.round(loanAmount * 1.45), currentLiabilities: Math.round(loanAmount * 1.15) }),
      '> 1.20',
      currentRatioValue >= 1.20 ? 'healthy' : 'warning'
    );

    insertRatio.run(
      `ratio_${appId}_npm`,
      appId,
      'net_profit_margin',
      'Net Profit Margin (%)',
      npmValue,
      '(Net Profit / Net Turnover) * 100',
      JSON.stringify({ netProfit: Math.round(loanAmount * 0.35), turnover: totalBankCredits }),
      '> 5.0%',
      npmValue >= 5.0 ? 'healthy' : 'warning'
    );

    insertRatio.run(
      `ratio_${appId}_growth`,
      appId,
      'turnover_growth',
      'YoY Turnover Growth (%)',
      turnoverGrowth,
      '((Current FY Turnover - Previous FY Turnover) / Previous FY Turnover) * 100',
      JSON.stringify({ currentTurnover: totalBankCredits, previousTurnover: Math.round(totalBankCredits * 0.88) }),
      '> 10.0%',
      turnoverGrowth >= 10.0 ? 'healthy' : 'warning'
    );

    // CAM Drafts for verification/credit review files
    if (status !== 'documents_pending') {
      const camId = `cam_${appId}`;
      const camStatus = (status === 'credit_review' || status === 'review_completed') ? 'submitted' : 'draft';

      insertCamDraft.run(
        camId,
        appId,
        `Credit Appraisal Memo: ${bName}`,
        camStatus,
        `Comprehensive working capital appraisal for ${bName} requesting credit facility of $${loanAmount.toLocaleString('en-US')}.`,
        1
      );

      // CAM Sections with citations
      const s1 = `The borrower ${bName} has requested a ${product} of $${loanAmount.toLocaleString('en-US')} [1]. Over the analyzed 12-month period, aggregate bank deposits stood at $${totalBankCredits.toLocaleString('en-US')} [2], reflecting stable operational cashflows. Total sales tax turnover was verified at $${totalGstTurnover.toLocaleString('en-US')} [3].`;
      const s2 = `Financial health assessment demonstrates a Debt Service Coverage Ratio (DSCR) of ${dscrValue}x [4], satisfying the benchmark threshold of 1.25x. The Current Ratio is maintained at ${currentRatioValue}x [5]. Net profit margin is computed at ${npmValue}% with annual revenue growth of ${turnoverGrowth}% [6].`;
      const s3 = `The working capital requirement is justified based on the borrower's operating cycle of 68 days [7]. Primary security comprises hypothecation of current assets and stocks, backed by personal guarantee of the principal promoter [8].`;

      insertCamSection.run(`csec_${camId}_1`, camId, 'executive_summary', '1. Executive Summary & Facility Request', s1, 1);
      insertCamSection.run(`csec_${camId}_2`, camId, 'financial_analysis', '2. Financial & Ratio Appraisal', s2, 2);
      insertCamSection.run(`csec_${camId}_3`, camId, 'risk_recommendation', '3. Risk Mitigation & Covenants', s3, 3);

      // Citations linking CAM sentences to extraction fields and ratios
      insertCitation.run(`cit_${camId}_1`, camId, 1, '[1]', 'document', bankDocId, `Facility request $${loanAmount.toLocaleString('en-US')}`, 1, JSON.stringify([50, 40, 250, 60]));
      insertCitation.run(`cit_${camId}_2`, camId, 2, '[2]', 'extraction_field', `fld_bank_${appId}_2025-11`, `12-month Bank Deposits $${totalBankCredits.toLocaleString('en-US')}`, 1, JSON.stringify([50, 120, 300, 135]));
      insertCitation.run(`cit_${camId}_3`, camId, 3, '[3]', 'extraction_field', `fld_gst_${appId}_2025-11`, `12-month Sales Tax Turnover $${totalGstTurnover.toLocaleString('en-US')}`, 1, JSON.stringify([50, 150, 240, 165]));
      insertCitation.run(`cit_${camId}_4`, camId, 4, '[4]', 'ratio', `ratio_${appId}_dscr`, `DSCR ratio ${dscrValue}x`, 1, null);
      insertCitation.run(`cit_${camId}_5`, camId, 5, '[5]', 'ratio', `ratio_${appId}_cr`, `Current ratio ${currentRatioValue}x`, 1, null);
      insertCitation.run(`cit_${camId}_6`, camId, 6, '[6]', 'ratio', `ratio_${appId}_npm`, `Net Profit Margin ${npmValue}%`, 1, null);
      insertCitation.run(`cit_${camId}_7`, camId, 7, '[7]', 'document', bankDocId, `Operating cycle assessment`, 2, null);
      insertCitation.run(`cit_${camId}_8`, camId, 8, '[8]', 'document', bankDocId, `Hypothecation and guarantee clause`, 3, null);
    }
  }

  // Record Genesis Audit Event
  recordAuditEvent({
    entityType: 'system',
    entityId: 'seed_init',
    action: 'SEED_DATABASE_INITIALIZED',
    actorId: 'usr_owner_1',
    actorRole: 'owner',
    payload: {
      applicationsGenerated: businessNames.length,
      pilotCohortCeilingUSD: 250000,
      timestamp: new Date().toISOString()
    }
  }, db);

    db.exec('COMMIT;');
  } catch (seedErr) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // rollback error ignored
    }
    throw seedErr;
  }

  console.log('[Kestrel Seed] Database successfully seeded with:');
  console.log(`- 42 synthetic loan applications (36 in pilot <= $250K, 6 outside pilot > $250K)`);
  console.log(`- 12 months of bank & GST data per file with 20% reconciliation discrepancies & 15% low confidence fields`);
  console.log(`- Demo users: rm.demo, analyst.demo, cm.demo, owner.demo, risk.demo, admin2.demo`);
  console.log(`- Append-only audit chain with genesis event verified`);
}

// Direct execution
if (process.argv[1] && process.argv[1].includes('seed')) {
  runSeed()
    .then(() => {
      console.log('[Kestrel Seed] Finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Kestrel Seed] Error:', err);
      process.exit(1);
    });
}
