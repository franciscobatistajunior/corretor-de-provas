import type { CvMat } from "../opencv/types";

const BLANK_THRESHOLD = 0.2;
const AMBIGUITY_MARGIN = 0.15;
const LOW_CONFIDENCE_MARGIN = 0.3;

/**
 * Fraction (0-1) of dark pixels within a disk centered at (cx, cy) in a
 * single-channel (grayscale) Mat. The radius should be smaller than the
 * printed bubble's own radius so the sampled disk stays inside the ring
 * and doesn't pick up the printed outline stroke itself.
 */
export function sampleFillRatio(gray: CvMat, cx: number, cy: number, radiusPx: number, darkThreshold: number): number {
  const data = gray.data;
  const width = gray.cols;
  const height = gray.rows;

  const minX = Math.max(0, Math.floor(cx - radiusPx));
  const maxX = Math.min(width - 1, Math.ceil(cx + radiusPx));
  const minY = Math.max(0, Math.floor(cy - radiusPx));
  const maxY = Math.min(height - 1, Math.ceil(cy + radiusPx));
  const radiusSq = radiusPx * radiusPx;

  let dark = 0;
  let total = 0;

  for (let y = minY; y <= maxY; y += 1) {
    const dy = y - cy;
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      if (dx * dx + dy * dy > radiusSq) continue;
      total += 1;
      if (data[y * width + x] < darkThreshold) {
        dark += 1;
      }
    }
  }

  return total === 0 ? 0 : dark / total;
}

export interface AnswerDecision {
  letter: string;
  ambiguous: boolean;
  lowConfidence: boolean;
}

const LETTERS = ["A", "B", "C", "D", "E"];

/** Picks the marked letter (if any) from a question's 5 fill ratios (A-E order). */
export function decideAnswer(fillRatios: number[]): AnswerDecision {
  const ranked = fillRatios
    .map((ratio, index) => ({ letter: LETTERS[index], ratio }))
    .sort((a, b) => b.ratio - a.ratio);

  const [top1, top2] = ranked;
  const margin = top1.ratio - top2.ratio;

  if (top1.ratio < BLANK_THRESHOLD) {
    return { letter: "", ambiguous: false, lowConfidence: false };
  }

  if (margin < AMBIGUITY_MARGIN) {
    return { letter: "", ambiguous: true, lowConfidence: false };
  }

  const lowConfidence = margin < LOW_CONFIDENCE_MARGIN || top1.ratio < BLANK_THRESHOLD * 1.5;
  return { letter: top1.letter, ambiguous: false, lowConfidence };
}
