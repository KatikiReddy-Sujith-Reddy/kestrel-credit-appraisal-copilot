export interface RatioCalculationInputs {
  pat: number;               // Profit After Tax
  depreciation: number;
  interest: number;
  debtObligation: number;    // Principal debt repayment
  currentAssets: number;
  currentLiabilities: number;
  netProfit: number;
  currentTurnover: number;
  previousTurnover: number;
}

export interface ComputedRatio {
  key: string;
  label: string;
  value: number;
  formattedValue: string;
  formula: string;
  inputs: Record<string, number>;
  scorecardVersion: string;
  benchmark: string;
  status: 'healthy' | 'warning' | 'breached';
}

export function calculateFinancialRatios(inputs: RatioCalculationInputs): Record<string, ComputedRatio> {
  const scorecardVersion = 'v2026.1';

  // 1. Debt Service Coverage Ratio (DSCR)
  // Formula: (PAT + Depreciation + Interest) / (Debt Obligation + Interest)
  const dscrNumerator = inputs.pat + inputs.depreciation + inputs.interest;
  const dscrDenominator = inputs.debtObligation + inputs.interest;
  const dscrValue = dscrDenominator > 0 ? Number((dscrNumerator / dscrDenominator).toFixed(2)) : 0;
  let dscrStatus: 'healthy' | 'warning' | 'breached' = 'healthy';
  if (dscrValue < 1.15) {
    dscrStatus = 'breached';
  } else if (dscrValue < 1.25) {
    dscrStatus = 'warning';
  }

  // 2. Current Ratio
  // Formula: Current Assets / Current Liabilities
  const crValue = inputs.currentLiabilities > 0 ? Number((inputs.currentAssets / inputs.currentLiabilities).toFixed(2)) : 0;
  let crStatus: 'healthy' | 'warning' | 'breached' = 'healthy';
  if (crValue < 1.0) {
    crStatus = 'breached';
  } else if (crValue < 1.20) {
    crStatus = 'warning';
  }

  // 3. Net Profit Margin (%)
  // Formula: (Net Profit / Current Turnover) * 100
  const npmValue = inputs.currentTurnover > 0 ? Number(((inputs.netProfit / inputs.currentTurnover) * 100).toFixed(2)) : 0;
  let npmStatus: 'healthy' | 'warning' | 'breached' = 'healthy';
  if (npmValue < 3.0) {
    npmStatus = 'breached';
  } else if (npmValue < 5.0) {
    npmStatus = 'warning';
  }

  // 4. YoY Turnover Growth (%)
  // Formula: ((Current Turnover - Previous Turnover) / Previous Turnover) * 100
  const growthValue = inputs.previousTurnover > 0
    ? Number((((inputs.currentTurnover - inputs.previousTurnover) / inputs.previousTurnover) * 100).toFixed(2))
    : 0;
  let growthStatus: 'healthy' | 'warning' | 'breached' = 'healthy';
  if (growthValue < 5.0) {
    growthStatus = 'breached';
  } else if (growthValue < 10.0) {
    growthStatus = 'warning';
  }

  return {
    dscr: {
      key: 'dscr',
      label: 'Debt Service Coverage Ratio (DSCR)',
      value: dscrValue,
      formattedValue: `${dscrValue}x`,
      formula: '(PAT + Depreciation + Interest) / (Debt Obligation + Interest)',
      inputs: {
        pat: inputs.pat,
        depreciation: inputs.depreciation,
        interest: inputs.interest,
        debtObligation: inputs.debtObligation,
      },
      scorecardVersion,
      benchmark: '>= 1.25x',
      status: dscrStatus,
    },
    current_ratio: {
      key: 'current_ratio',
      label: 'Current Ratio',
      value: crValue,
      formattedValue: `${crValue}x`,
      formula: 'Current Assets / Current Liabilities',
      inputs: {
        currentAssets: inputs.currentAssets,
        currentLiabilities: inputs.currentLiabilities,
      },
      scorecardVersion,
      benchmark: '>= 1.20x',
      status: crStatus,
    },
    net_profit_margin: {
      key: 'net_profit_margin',
      label: 'Net Profit Margin (%)',
      value: npmValue,
      formattedValue: `${npmValue}%`,
      formula: '(Net Profit / Net Turnover) * 100',
      inputs: {
        netProfit: inputs.netProfit,
        currentTurnover: inputs.currentTurnover,
      },
      scorecardVersion,
      benchmark: '>= 5.0%',
      status: npmStatus,
    },
    turnover_growth: {
      key: 'turnover_growth',
      label: 'YoY Turnover Growth (%)',
      value: growthValue,
      formattedValue: `${growthValue}%`,
      formula: '((Current FY Turnover - Previous FY Turnover) / Previous FY Turnover) * 100',
      inputs: {
        currentTurnover: inputs.currentTurnover,
        previousTurnover: inputs.previousTurnover,
      },
      scorecardVersion,
      benchmark: '>= 10.0%',
      status: growthStatus,
    },
  };
}
