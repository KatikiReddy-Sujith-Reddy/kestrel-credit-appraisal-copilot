export interface RequiredChecklistItem {
  key: string;
  label: string;
  required: boolean;
  period: string | null;
  allowedMimeTypes: string[];
  ownerRole: string;
}

export function evaluateChecklistRules(product: string, loanAmount: number): RequiredChecklistItem[] {
  const items: RequiredChecklistItem[] = [
    {
      key: 'bank_statement_12m',
      label: '12-Month Operative Bank Statements',
      required: true,
      period: '12 Months (Dec 2024 - Nov 2025)',
      allowedMimeTypes: ['application/pdf'],
      ownerRole: 'rm',
    },
    {
      key: 'gstr3b_12m',
      label: '12-Month GSTR-3B Summary Returns',
      required: true,
      period: '12 Months (Dec 2024 - Nov 2025)',
      allowedMimeTypes: ['application/pdf'],
      ownerRole: 'rm',
    },
    {
      key: 'gstr1_12m',
      label: '12-Month GSTR-1 Outward Supplies',
      required: true,
      period: '12 Months (Dec 2024 - Nov 2025)',
      allowedMimeTypes: ['application/pdf'],
      ownerRole: 'rm',
    },
    {
      key: 'pan_card',
      label: 'Entity & Promoter PAN Cards',
      required: true,
      period: null,
      allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
      ownerRole: 'rm',
    },
    {
      key: 'udyam_cert',
      label: 'Udyam MSME Registration Certificate',
      required: true,
      period: null,
      allowedMimeTypes: ['application/pdf'],
      ownerRole: 'rm',
    },
  ];

  // For loan amounts >= $150,000, audited financials are required
  if (loanAmount >= 150000) {
    items.push({
      key: 'audited_financials_2y',
      label: 'Audited Financial Statements (Last 2 Years)',
      required: true,
      period: 'FY 2023-24 & FY 2024-25',
      allowedMimeTypes: ['application/pdf'],
      ownerRole: 'rm',
    });
  }

  // For Term Loans, project quotation / invoice proforma is required
  if (product.toLowerCase().includes('term loan')) {
    items.push({
      key: 'machinery_quotation',
      label: 'Machinery / Equipment Proforma Quotation',
      required: true,
      period: null,
      allowedMimeTypes: ['application/pdf'],
      ownerRole: 'rm',
    });
  }

  return items;
}
