export interface GroundingCheckResult {
  isValid: boolean;
  totalSentences: number;
  citedSentenceCount: number;
  uncitedSentenceCount: number;
  uncitedSentences: string[];
}

export function checkCamGrounding(camFullText: string, availableCitationMarkers: string[]): GroundingCheckResult {
  if (!camFullText || camFullText.trim().length === 0) {
    return {
      isValid: false,
      totalSentences: 0,
      citedSentenceCount: 0,
      uncitedSentenceCount: 0,
      uncitedSentences: [],
    };
  }

  // Split into sentences using punctuation boundaries
  const rawSentences = camFullText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && !s.startsWith('#') && !s.match(/^\d+\.\s+[A-Z]/)); // Filter headers

  const markerRegex = /\[(\d+|[A-Za-z0-9_-]+)\]/g;
  const uncited: string[] = [];
  let citedCount = 0;

  for (const sentence of rawSentences) {
    const matches = sentence.match(markerRegex);
    if (!matches || matches.length === 0) {
      uncited.push(sentence);
      continue;
    }

    // Check if at least one marker exists in the valid citations list
    const hasValidCitation = matches.some((m) =>
      availableCitationMarkers.length === 0 || availableCitationMarkers.includes(m)
    );

    if (hasValidCitation) {
      citedCount++;
    } else {
      uncited.push(sentence);
    }
  }

  return {
    isValid: uncited.length === 0 && citedCount > 0,
    totalSentences: rawSentences.length,
    citedSentenceCount: citedCount,
    uncitedSentenceCount: uncited.length,
    uncitedSentences: uncited,
  };
}
