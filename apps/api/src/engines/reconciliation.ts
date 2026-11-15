export interface MonthlyDataPoint {
  month: string;
  amount: number;
}

export interface MonthlyReconciliationRow {
  month: string;
  bankCredits: number;
  gstTurnover: number;
  gap: number; // bankCredits - gstTurnover
  gapPercentage: number;
  isDiscrepant: boolean;
}

export interface ReconciliationReport {
  totalBankCredits: number;
  totalGstTurnover: number;
  netGap: number;
  netGapPercentage: number;
  tolerancePercentage: number;
  isReconciled: boolean;
  materialDiscrepanciesCount: number;
  rows: MonthlyReconciliationRow[];
}

export function reconcileBankAndGst(
  bankCredits: MonthlyDataPoint[],
  gstTurnovers: MonthlyDataPoint[],
  tolerancePct: number = 10.0
): ReconciliationReport {
  const bankMap = new Map<string, number>();
  for (const b of bankCredits) {
    bankMap.set(b.month, b.amount);
  }

  const gstMap = new Map<string, number>();
  for (const g of gstTurnovers) {
    gstMap.set(g.month, g.amount);
  }

  const allMonths = Array.from(new Set([...bankMap.keys(), ...gstMap.keys()])).sort().reverse();

  let totalBank = 0;
  let totalGst = 0;
  let materialCount = 0;

  const rows: MonthlyReconciliationRow[] = allMonths.map((m) => {
    const bAmt = bankMap.get(m) || 0;
    const gAmt = gstMap.get(m) || 0;
    const gap = bAmt - gAmt;
    const gapPct = gAmt > 0 ? Number(((gap / gAmt) * 100).toFixed(2)) : 0;
    const isDiscrepant = Math.abs(gapPct) > tolerancePct;

    totalBank += bAmt;
    totalGst += gAmt;
    if (isDiscrepant) {
      materialCount++;
    }

    return {
      month: m,
      bankCredits: bAmt,
      gstTurnover: gAmt,
      gap,
      gapPercentage: gapPct,
      isDiscrepant,
    };
  });

  const netGap = totalBank - totalGst;
  const netGapPercentage = totalGst > 0 ? Number(((netGap / totalGst) * 100).toFixed(2)) : 0;
  const isReconciled = Math.abs(netGapPercentage) <= tolerancePct && materialCount === 0;

  return {
    totalBankCredits: totalBank,
    totalGstTurnover: totalGst,
    netGap,
    netGapPercentage,
    tolerancePercentage: tolerancePct,
    isReconciled,
    materialDiscrepanciesCount: materialCount,
    rows,
  };
}
