import { describe, it, expect } from 'vitest';
import { evaluateChecklistRules } from '../src/engines/checklist.js';
import { validateDocument, sniffMimeTypeFromBuffer, NAMED_RULES } from '../src/engines/validation.js';
import { reconcileBankAndGst } from '../src/engines/reconciliation.js';
import { calculateFinancialRatios } from '../src/engines/ratios.js';
import { checkCamGrounding } from '../src/engines/grounding.js';

describe('Deterministic Engines Test Suite', () => {
  describe('Checklist Rules Engine', () => {
    it('returns core required documents for working capital loan < $150k', () => {
      const items = evaluateChecklistRules('Working Capital Demand Loan', 120000);
      const keys = items.map((i) => i.key);
      expect(keys).toContain('bank_statement_12m');
      expect(keys).toContain('gstr3b_12m');
      expect(keys).toContain('gstr1_12m');
      expect(keys).toContain('pan_card');
      expect(keys).toContain('udyam_cert');
      expect(keys).not.toContain('audited_financials_2y');
    });

    it('requires audited financials for loans >= $150k', () => {
      const items = evaluateChecklistRules('Secured Cash Credit Facility', 180000);
      const keys = items.map((i) => i.key);
      expect(keys).toContain('audited_financials_2y');
    });
  });

  describe('Validation Engine', () => {
    it('sniffs PDF magic bytes correctly from buffer', () => {
      const pdfHeader = Buffer.from('%PDF-1.4\nrest of file');
      expect(sniffMimeTypeFromBuffer(pdfHeader)).toBe('application/pdf');

      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      expect(sniffMimeTypeFromBuffer(pngHeader)).toBe('image/png');

      const badHeader = Buffer.from('EXE_VIRUS_FAKE');
      expect(sniffMimeTypeFromBuffer(badHeader)).toBeNull();
    });

    it('rejects disallowed MIME types with RULE_MIME_ALLOWLIST', () => {
      const res = validateDocument({
        filename: 'statement.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 2048,
      });
      expect(res.isValid).toBe(false);
      expect(res.failingRule).toBe(NAMED_RULES.RULE_MIME_ALLOWLIST);
    });

    it('rejects oversized files with RULE_SIZE_LIMIT', () => {
      const res = validateDocument({
        filename: 'huge_scan.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 15 * 1024 * 1024, // 15MB
      });
      expect(res.isValid).toBe(false);
      expect(res.failingRule).toBe(NAMED_RULES.RULE_SIZE_LIMIT);
    });

    it('rejects unreadable files with RULE_READABILITY', () => {
      const res = validateDocument({
        filename: 'corrupt.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10240,
        isReadable: false,
      });
      expect(res.isValid).toBe(false);
      expect(res.failingRule).toBe(NAMED_RULES.RULE_READABILITY);
    });

    it('validates a conforming 12-month document successfully', () => {
      const res = validateDocument({
        filename: 'hdfc_bank_12m.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 524288,
        periodMonthsCovered: 12,
        isReadable: true,
        totalCredits: 1850000,
      });
      expect(res.isValid).toBe(true);
      expect(res.failingRule).toBeNull();
    });
  });

  describe('Reconciliation Engine', () => {
    it('computes bank vs GST gap correctly within tolerance', () => {
      const bank = [
        { month: '2025-11', amount: 100000 },
        { month: '2025-10', amount: 100000 },
      ];
      const gst = [
        { month: '2025-11', amount: 98000 },
        { month: '2025-10', amount: 102000 },
      ];
      const report = reconcileBankAndGst(bank, gst, 10.0);
      expect(report.totalBankCredits).toBe(200000);
      expect(report.totalGstTurnover).toBe(200000);
      expect(report.netGap).toBe(0);
      expect(report.isReconciled).toBe(true);
      expect(report.materialDiscrepanciesCount).toBe(0);
    });

    it('flags material discrepancy when bank credits exceed tolerance', () => {
      const bank = [{ month: '2025-11', amount: 150000 }];
      const gst = [{ month: '2025-11', amount: 100000 }];
      const report = reconcileBankAndGst(bank, gst, 10.0);
      expect(report.netGap).toBe(50000);
      expect(report.netGapPercentage).toBe(50.0);
      expect(report.isReconciled).toBe(false);
      expect(report.materialDiscrepanciesCount).toBe(1);
    });
  });

  describe('Financial Ratio Engine', () => {
    it('computes DSCR, Current Ratio, NPM and Growth with transparent formulas', () => {
      const ratios = calculateFinancialRatios({
        pat: 850000,
        depreciation: 210000,
        interest: 320000,
        debtObligation: 740000,
        currentAssets: 3450000,
        currentLiabilities: 2750000,
        netProfit: 850000,
        currentTurnover: 12500000,
        previousTurnover: 10800000,
      });

      // DSCR: (850k + 210k + 320k) / (740k + 320k) = 1380k / 1060k = 1.30
      expect(ratios.dscr.value).toBe(1.30);
      expect(ratios.dscr.status).toBe('healthy');

      // Current Ratio: 3450k / 2750k = 1.25
      expect(ratios.current_ratio.value).toBe(1.25);
      expect(ratios.current_ratio.status).toBe('healthy');

      // NPM: (850k / 12500k) * 100 = 6.8%
      expect(ratios.net_profit_margin.value).toBe(6.8);
      expect(ratios.net_profit_margin.status).toBe('healthy');

      // Growth: ((12500k - 10800k) / 10800k) * 100 = 15.74%
      expect(ratios.turnover_growth.value).toBe(15.74);
      expect(ratios.turnover_growth.status).toBe('healthy');
    });
  });

  describe('CAM Grounding Engine', () => {
    it('passes when every factual sentence contains a valid citation', () => {
      const text = 'The borrower has requested a working capital facility [1]. Bank deposits stood at $240,000 over 12 months [2].';
      const result = checkCamGrounding(text, ['[1]', '[2]']);
      expect(result.isValid).toBe(true);
      expect(result.uncitedSentenceCount).toBe(0);
      expect(result.citedSentenceCount).toBe(2);
    });

    it('fails when an uncited assertion exists', () => {
      const text = 'The borrower has requested a loan [1]. The company has 100 employees and no pending litigation.';
      const result = checkCamGrounding(text, ['[1]']);
      expect(result.isValid).toBe(false);
      expect(result.uncitedSentenceCount).toBe(1);
      expect(result.uncitedSentences[0]).toContain('The company has 100 employees');
    });
  });
});
