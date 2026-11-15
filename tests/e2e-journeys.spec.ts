/**
 * Kestrel Credit Appraisal Copilot - End-to-End Journey Playwright Test Suite
 * Covers all 4 user journeys specified in docs/JTBD.md and docs/ARCHITECTURE.md:
 * 1. Relationship Manager (Pipeline, Pilot Scope Filter, Document Upload, Follow-up Draft)
 * 2. Credit Analyst (Ledger Spreading, Source OCR Bounding Boxes, Reconciliation, Ratios, Grounded CAM, Formal Sign-Off)
 * 3. Credit Manager (Review Queue, Evidence Inspection, Threaded Comments, Complete Review with LOS Reference)
 * 4. System Owner (Governance Dashboard, INR Cost Telemetry, 8-Step Model Wizard, Evaluation Metrics, Audit Export)
 */

import { test, expect } from '@playwright/test';

test.describe('Kestrel Credit Appraisal Copilot - Complete Journey Verification', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to root (redirects to /sign-in)
    await page.goto('http://localhost:5173');
  });

  test('Journey 1: Relationship Manager Pipeline & Follow-up Draft', async ({ page }) => {
    // 1. Sign In
    await page.fill('input[type="text"]', 'rm.demo');
    await page.fill('input[type="password"]', 'Kestrel@RM2026!');
    await page.click('button:has-text("Continue to MFA")');

    // 2. Simulated MFA Code
    await expect(page.locator('text=SIMULATED MFA CHALLENGE')).toBeVisible();
    await page.click('button:has-text("Verify & Sign In")');

    // 3. RM Dashboard & Pilot Scope
    await expect(page).toHaveURL(/.*\/rm/);
    await expect(page.locator('text=Active Borrower Applications')).toBeVisible();

    // Toggle pilot scope (< ₹25L)
    const pilotCheckbox = page.locator('input[type="checkbox"]');
    if (!await pilotCheckbox.isChecked()) {
      await pilotCheckbox.check();
    }

    // 4. View First Application
    await page.click('table tbody tr:first-child a:has-text("Open Workspace")');
    await expect(page.locator('text=Overview')).toBeVisible();

    // 5. Checklist Tab & Generate Follow-up
    await page.click('button:has-text("Follow-ups")');
    await page.click('button:has-text("Generate Follow-up Draft")');

    // 6. Exclusion Check & Send Draft
    const exclusionCheck = page.locator('input[id="exclusion_ack"]');
    await exclusionCheck.check();
    await page.click('button:has-text("Send Follow-up")');
    await expect(page.locator('text=Follow-up sent successfully')).toBeVisible();
  });

  test('Journey 2: Credit Analyst Spreading, Grounding & Gated Submission', async ({ page }) => {
    // 1. Sign In
    await page.fill('input[type="text"]', 'analyst.demo');
    await page.fill('input[type="password"]', 'Kestrel@Analyst2026!');
    await page.click('button:has-text("Continue to MFA")');
    await page.click('button:has-text("Verify & Sign In")');

    // 2. Analyst Queue
    await expect(page).toHaveURL(/.*\/analyst/);
    await page.click('table tbody tr:first-child a:has-text("Open Spreading")');

    // 3. Three-Pane Workspace
    await expect(page.locator('text=Source Document & OCR Coordinates')).toBeVisible();

    // 4. Spreading Tab: Reconciliation
    await page.click('button:has-text("Reconciliation")');
    await expect(page.locator('text=Turnover Gap')).toBeVisible();

    // 5. Spreading Tab: Ratios
    await page.click('button:has-text("Ratios & Scorecards")');
    await expect(page.locator('text=DSCR')).toBeVisible();

    // 6. CAM Synthesis & Grounding
    await page.click('button:has-text("Credit Memorandum (CAM)")');
    await expect(page.locator('text=Grounded')).toBeVisible();

    // 7. Formal Verification Sign-off
    await page.click('button:has-text("Formal Verification Sign-Off")');
    await page.fill('textarea', 'I confirm that all financial extractions and bank reconciliation schedules have been verified against original documents.');
    await page.click('button:has-text("Sign Verification Statement")');

    // 8. Submit to Credit Queue
    await page.click('button:has-text("Submit to Credit Review")');
    await expect(page.locator('text=Application submitted to Credit Manager')).toBeVisible();
  });

  test('Journey 3: Credit Manager Review & Action', async ({ page }) => {
    // 1. Sign In
    await page.fill('input[type="text"]', 'cm.demo');
    await page.fill('input[type="password"]', 'Kestrel@CM2026!');
    await page.click('button:has-text("Continue to MFA")');
    await page.click('button:has-text("Verify & Sign In")');

    // 2. Credit Queue
    await expect(page).toHaveURL(/.*\/credit/);
    await expect(page.locator('text=Not a credit decision')).toBeVisible();

    // 3. Open Pending Review
    await page.click('table tbody tr:first-child a:has-text("Review CAM")');

    // 4. Comment with Mentions
    await page.fill('input[placeholder*="comment"]', 'Reviewed debt service buffer with @analyst.demo. Satisfactory.');
    await page.click('button:has-text("Post Comment")');

    // 5. Complete Review with LOS Reference
    await page.click('button:has-text("Complete Review")');
    await page.fill('textarea[placeholder*="comment"]', 'Credit memorandum verified. Ready for manual sanction recording.');
    await page.fill('input[placeholder*="LOS"]', 'LOS-MUM-2026-SYN-9912');
    await page.click('button:has-text("Confirm Completion")');
    await expect(page.locator('text=Review completed successfully')).toBeVisible();
  });

  test('Journey 4: System Owner Governance, Spend & 8-Step Model Wizard', async ({ page }) => {
    // 1. Sign In via Owner Tab
    await page.click('button:has-text("Owner Sign-in")');
    await page.fill('input[type="text"]', 'sanjay.gupta@kestrel-synthetic.bank');
    await page.click('button:has-text("Verify Hardware Token")');
    await page.click('button:has-text("Verify & Sign In")');

    // 2. Owner Governance Dashboard
    await expect(page).toHaveURL(/.*\/owner/);
    await expect(page.locator('text=Estimated Total Spend (INR)')).toBeVisible();

    // 3. Model Registry & Wizard
    await page.click('button:has-text("Model Governance")');
    await page.click('button:has-text("Propose Model Change")');
    await page.selectOption('select', 'gemini-2.5-pro');
    await page.fill('textarea', 'Upgrading primary model for enhanced balance sheet reasoning.');
    await page.click('button:has-text("Submit Proposal")');
    await expect(page.locator('text=Secondary Approver Required')).toBeVisible();

    // 4. Evaluation Metrics
    await page.click('button:has-text("Evaluations")');
    await expect(page.locator('text=CAM Sentence Grounding Accuracy')).toBeVisible();

    // 5. Immutable Audit Export
    await page.click('button:has-text("Audit Trail")');
    await page.click('button:has-text("Export Audit Ledger")');
    await expect(page.locator('text=SHA-256 Checksum')).toBeVisible();
  });

  test('Responsive Layout Verification (375px Viewport Width)', async ({ page }) => {
    // Set iPhone SE / compact viewport width
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5173/sign-in');

    // Verify root layout does not cause horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px rounding tolerance
  });
});
