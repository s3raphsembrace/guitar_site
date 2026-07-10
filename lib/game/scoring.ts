export type AccuracyRating = "PERFECT" | "GOOD" | "OK" | "MISS";

export function rateAccuracy(detectedHz: number, targetHz: number): AccuracyRating {
  if (targetHz === 0 || detectedHz === 0) return "MISS";
  const centsDiff = 1200 * Math.abs(Math.log2(detectedHz / targetHz));
  if (centsDiff < 10) return "PERFECT";
  if (centsDiff < 25) return "GOOD";
  if (centsDiff < 50) return "OK";
  return "MISS";
}

export function calcScore(rating: AccuracyRating, streak: number): number {
  const base = { PERFECT: 100, GOOD: 70, OK: 40, MISS: 0 }[rating];
  const multiplier = Math.min(1 + streak * 0.1, 3);
  return Math.round(base * multiplier);
}
