export interface DocumentValidationInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  periodMonthsCovered?: number;
  issueDate?: string;
  expiryDate?: string;
  isReadable?: boolean;
  totalDebits?: number;
  totalCredits?: number;
}

export interface ValidationResult {
  isValid: boolean;
  failingRule: string | null;
  errors: string[];
}

export const NAMED_RULES = {
  RULE_MIME_ALLOWLIST: 'RULE_MIME_ALLOWLIST',
  RULE_SIZE_LIMIT: 'RULE_SIZE_LIMIT',
  RULE_PERIOD_COVERAGE: 'RULE_PERIOD_COVERAGE',
  RULE_EXPIRY: 'RULE_EXPIRY',
  RULE_READABILITY: 'RULE_READABILITY',
  RULE_TOTALS_SANITY: 'RULE_TOTALS_SANITY',
} as const;

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function sniffMimeTypeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length >= 4) {
    // PDF Magic bytes: %PDF- (0x25 0x50 0x44 0x46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'application/pdf';
    }
    // PNG Magic bytes: \x89PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    // JPEG Magic bytes: 0xFF 0xD8 0xFF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
  }
  return null;
}

export function validateDocument(input: DocumentValidationInput): ValidationResult {
  const errors: string[] = [];

  // 1. MIME Allowlist
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
    return {
      isValid: false,
      failingRule: NAMED_RULES.RULE_MIME_ALLOWLIST,
      errors: [`Disallowed MIME type '${input.mimeType}'. Allowed: [application/pdf, image/png, image/jpeg].`],
    };
  }

  // 2. Size Limit
  if (input.sizeBytes > MAX_FILE_SIZE) {
    return {
      isValid: false,
      failingRule: NAMED_RULES.RULE_SIZE_LIMIT,
      errors: [`File size (${(input.sizeBytes / 1024 / 1024).toFixed(2)} MB) exceeds 10 MB system threshold.`],
    };
  }

  // 3. Readability check
  if (input.isReadable === false) {
    return {
      isValid: false,
      failingRule: NAMED_RULES.RULE_READABILITY,
      errors: ['Document readability scan failed: resolution under 150 DPI or unreadable raster stream.'],
    };
  }

  // 4. Period Coverage (if monthly statement)
  if (input.periodMonthsCovered !== undefined && input.periodMonthsCovered < 12) {
    return {
      isValid: false,
      failingRule: NAMED_RULES.RULE_PERIOD_COVERAGE,
      errors: [`Period coverage insufficient: found ${input.periodMonthsCovered} months, required 12 consecutive months.`],
    };
  }

  // 5. Expiry Check
  if (input.expiryDate) {
    const exp = new Date(input.expiryDate).getTime();
    if (Date.now() > exp) {
      return {
        isValid: false,
        failingRule: NAMED_RULES.RULE_EXPIRY,
        errors: [`Document has expired on ${input.expiryDate}. Current validity is required.`],
      };
    }
  }

  // 6. Totals Sanity
  if (input.totalCredits !== undefined && input.totalCredits < 0) {
    return {
      isValid: false,
      failingRule: NAMED_RULES.RULE_TOTALS_SANITY,
      errors: ['Negative credit turnover detected in arithmetic ledger summary.'],
    };
  }

  return {
    isValid: true,
    failingRule: null,
    errors: [],
  };
}
