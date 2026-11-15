-- Kestrel Credit Appraisal Copilot Database Schema (SQLite)

-- 1. Identity & RBAC
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  is_synthetic INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 2. Applications & Workflows
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  application_number TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  loan_amount REAL NOT NULL,
  loan_product TEXT NOT NULL,
  status TEXT NOT NULL, -- 'draft', 'documents_pending', 'verification_queue', 'credit_review', 'returned_to_analyst', 'review_completed'
  pilot_scope_flag INTEGER NOT NULL, -- 1 = in pilot (< 25 Lakh), 0 = outside pilot
  completeness_score REAL DEFAULT 0,
  rm_user_id TEXT,
  analyst_user_id TEXT,
  cm_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (rm_user_id) REFERENCES users(id),
  FOREIGN KEY (analyst_user_id) REFERENCES users(id),
  FOREIGN KEY (cm_user_id) REFERENCES users(id)
);

-- 3. Document Checklist & Files
CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  required INTEGER DEFAULT 1,
  period TEXT,
  allowed_file_types TEXT NOT NULL, -- JSON array string
  owner_role TEXT NOT NULL,
  status TEXT NOT NULL, -- 'missing', 'uploaded', 'valid', 'invalid', 'expired'
  document_id TEXT,
  failing_rule TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  checklist_item_id TEXT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  is_synthetic INTEGER DEFAULT 1,
  page_count INTEGER DEFAULT 1,
  status TEXT NOT NULL, -- 'pending', 'validated', 'rejected'
  validation_errors TEXT, -- JSON array
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  text_layer_json TEXT NOT NULL, -- words, tokens, bounding boxes
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 4. Extraction & Financial Fields
CREATE TABLE IF NOT EXISTS extraction_jobs (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  document_id TEXT,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL, -- 'queued', 'running', 'completed', 'failed'
  idempotency_key TEXT UNIQUE NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS extraction_fields (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  document_id TEXT,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL, -- 'bank', 'gst', 'kyc', 'financial'
  extracted_value TEXT NOT NULL,
  normalized_value REAL,
  confidence_score REAL NOT NULL, -- 0.0 to 1.0
  auto_accepted INTEGER DEFAULT 1,
  verified INTEGER DEFAULT 0,
  edited INTEGER DEFAULT 0,
  source_document_id TEXT,
  source_page_number INTEGER,
  bounding_box_json TEXT,
  period_month TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- Field Edit History (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS extraction_field_history (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL,
  previous_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  edit_reason TEXT NOT NULL,
  edited_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (field_id) REFERENCES extraction_fields(id) ON DELETE CASCADE
);

-- 5. Reconciliation & Discrepancies
CREATE TABLE IF NOT EXISTS discrepancies (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'gst_vs_bank', 'period_gap', 'turnover_mismatch'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  bank_value REAL,
  gst_value REAL,
  variance_value REAL,
  variance_percentage REAL,
  status TEXT NOT NULL, -- 'open', 'explained', 'corrected', 'escalated'
  resolution_type TEXT,
  resolution_notes TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  is_material INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- 6. Deterministic Ratios
CREATE TABLE IF NOT EXISTS ratios (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  ratio_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value REAL NOT NULL,
  formula TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  scorecard_version TEXT NOT NULL,
  benchmark TEXT,
  status TEXT NOT NULL, -- 'healthy', 'warning', 'breached'
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- 7. CAM Drafts, Citations & Signoffs
CREATE TABLE IF NOT EXISTS cam_drafts (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL, -- 'draft', 'submitted', 'returned', 'reviewed'
  overall_summary TEXT,
  is_grounding_valid INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cam_sections (
  id TEXT PRIMARY KEY,
  cam_draft_id TEXT NOT NULL,
  section_key TEXT NOT NULL,
  section_title TEXT NOT NULL,
  content_text TEXT NOT NULL,
  ordering INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (cam_draft_id) REFERENCES cam_drafts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS citations (
  id TEXT PRIMARY KEY,
  cam_draft_id TEXT NOT NULL,
  citation_number INTEGER NOT NULL,
  marker TEXT NOT NULL, -- e.g. '[1]', '[HDFC-STMT-P3-R4]'
  entity_type TEXT NOT NULL, -- 'extraction_field', 'ratio', 'document'
  entity_id TEXT,
  source_excerpt TEXT NOT NULL,
  source_page INTEGER,
  bounding_box_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (cam_draft_id) REFERENCES cam_drafts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification_signoffs (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  analyst_id TEXT NOT NULL,
  signoff_statement TEXT NOT NULL,
  signed_at TEXT NOT NULL,
  audit_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (analyst_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS review_actions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  credit_manager_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'return', 'complete'
  comments TEXT NOT NULL,
  los_reference TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (credit_manager_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  content TEXT NOT NULL,
  mentions_json TEXT, -- JSON array
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- 8. Follow-ups & Notifications
CREATE TABLE IF NOT EXISTS follow_up_drafts (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  channel TEXT NOT NULL, -- 'email', 'sms', 'portal'
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  missing_items_json TEXT NOT NULL,
  status TEXT NOT NULL, -- 'draft', 'sent'
  exclusions_acknowledged INTEGER DEFAULT 0,
  sent_at TEXT,
  sent_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. Model Gateway, Registry & Telemetry (APPEND-ONLY FOR TELEMETRY)
CREATE TABLE IF NOT EXISTS model_registry (
  model_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  deployment TEXT NOT NULL,
  region TEXT NOT NULL,
  residency_status TEXT NOT NULL, -- 'Approved', 'Pending approval', 'Blocked'
  input_price_per_million REAL NOT NULL,
  output_price_per_million REAL NOT NULL,
  price_version TEXT NOT NULL,
  context_limit INTEGER NOT NULL,
  capabilities_json TEXT NOT NULL,
  compatible_agents_json TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  is_fallback INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_configuration_versions (
  id TEXT PRIMARY KEY,
  version_number INTEGER NOT NULL,
  primary_model_id TEXT NOT NULL,
  fallback_model_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  proposed_by TEXT NOT NULL,
  approved_by TEXT,
  effective_at TEXT NOT NULL,
  status TEXT NOT NULL, -- 'draft', 'pending_approval', 'active', 'superseded'
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_change_requests (
  id TEXT PRIMARY KEY,
  target_model_id TEXT NOT NULL,
  target_role TEXT NOT NULL, -- 'primary', 'fallback'
  status TEXT NOT NULL, -- 'proposed', 'compatibility_passed', 'connectivity_passed', 'validated', 'confirmed', 'approved', 'applied', 'rejected'
  reason TEXT NOT NULL,
  author_id TEXT NOT NULL,
  approver_id TEXT,
  step_progress INTEGER DEFAULT 1,
  effective_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  body TEXT NOT NULL,
  change_note TEXT NOT NULL,
  author_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'draft', 'pending_approval', 'published', 'superseded'
  risk_class TEXT NOT NULL, -- 'credit_relevant', 'operational'
  approver_id TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_change_requests (
  id TEXT PRIMARY KEY,
  prompt_version_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  approver_id TEXT,
  status TEXT NOT NULL, -- 'pending', 'approved', 'rejected'
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  sample_count INTEGER NOT NULL,
  is_synthetic INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  status TEXT NOT NULL,
  results_json TEXT NOT NULL,
  run_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_metrics (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  label TEXT NOT NULL,
  score REAL NOT NULL,
  threshold REAL NOT NULL,
  passed INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES evaluation_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evaluation_alerts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'warning', 'critical'
  acknowledged INTEGER DEFAULT 0,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_change_requests (
  id TEXT PRIMARY KEY,
  target_user_id TEXT NOT NULL,
  requested_role TEXT NOT NULL,
  reason TEXT NOT NULL,
  author_id TEXT NOT NULL,
  approver_id TEXT,
  status TEXT NOT NULL, -- 'pending', 'approved', 'rejected'
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS configuration_items (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NOT NULL,
  is_secret INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS configuration_change_requests (
  id TEXT PRIMARY KEY,
  config_key TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  author_id TEXT NOT NULL,
  approver_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

-- APPEND-ONLY TABLES: agent_executions, llm_calls, security_events, access_logs, audit_events

CREATE TABLE IF NOT EXISTS agent_executions (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  task_id TEXT,
  application_id TEXT,
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  input_json TEXT,
  output_json TEXT,
  duration_ms INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS llm_calls (
  call_id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  application_id TEXT,
  task_id TEXT,
  agent_name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cached_tokens INTEGER DEFAULT 0,
  input_price REAL NOT NULL,
  output_price REAL NOT NULL,
  price_version TEXT NOT NULL,
  estimated_cost REAL NOT NULL,
  provider_reported_cost REAL,
  currency TEXT DEFAULT 'USD',
  duration_ms INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  fallback_used INTEGER DEFAULT 0,
  prompt_version_id TEXT
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_logs (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  access_type TEXT NOT NULL, -- 'download', 'preview', 'stream'
  ip_address TEXT,
  user_agent TEXT,
  token_hash TEXT NOT NULL,
  accessed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

-- TRIGGERS TO PREVENT UPDATE AND DELETE ON APPEND-ONLY TABLES

-- audit_events
CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_update
BEFORE UPDATE ON audit_events BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only: UPDATE disallowed');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_delete
BEFORE DELETE ON audit_events BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only: DELETE disallowed');
END;

-- access_logs
CREATE TRIGGER IF NOT EXISTS trg_access_logs_no_update
BEFORE UPDATE ON access_logs BEGIN
  SELECT RAISE(ABORT, 'access_logs is append-only: UPDATE disallowed');
END;

CREATE TRIGGER IF NOT EXISTS trg_access_logs_no_delete
BEFORE DELETE ON access_logs BEGIN
  SELECT RAISE(ABORT, 'access_logs is append-only: DELETE disallowed');
END;

-- llm_calls
CREATE TRIGGER IF NOT EXISTS trg_llm_calls_no_update
BEFORE UPDATE ON llm_calls BEGIN
  SELECT RAISE(ABORT, 'llm_calls is append-only: UPDATE disallowed');
END;

CREATE TRIGGER IF NOT EXISTS trg_llm_calls_no_delete
BEFORE DELETE ON llm_calls BEGIN
  SELECT RAISE(ABORT, 'llm_calls is append-only: DELETE disallowed');
END;

-- agent_executions
CREATE TRIGGER IF NOT EXISTS trg_agent_executions_no_update
BEFORE UPDATE ON agent_executions BEGIN
  SELECT RAISE(ABORT, 'agent_executions is append-only: UPDATE disallowed');
END;

CREATE TRIGGER IF NOT EXISTS trg_agent_executions_no_delete
BEFORE DELETE ON agent_executions BEGIN
  SELECT RAISE(ABORT, 'agent_executions is append-only: DELETE disallowed');
END;

-- security_events
CREATE TRIGGER IF NOT EXISTS trg_security_events_no_update
BEFORE UPDATE ON security_events BEGIN
  SELECT RAISE(ABORT, 'security_events is append-only: UPDATE disallowed');
END;

CREATE TRIGGER IF NOT EXISTS trg_security_events_no_delete
BEFORE DELETE ON security_events BEGIN
  SELECT RAISE(ABORT, 'security_events is append-only: DELETE disallowed');
END;

-- extraction_field_history
CREATE TRIGGER IF NOT EXISTS trg_extraction_field_history_no_update
BEFORE UPDATE ON extraction_field_history BEGIN
  SELECT RAISE(ABORT, 'extraction_field_history is append-only: UPDATE disallowed');
END;

CREATE TRIGGER IF NOT EXISTS trg_extraction_field_history_no_delete
BEFORE DELETE ON extraction_field_history BEGIN
  SELECT RAISE(ABORT, 'extraction_field_history is append-only: DELETE disallowed');
END;
