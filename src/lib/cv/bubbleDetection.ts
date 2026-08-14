import { getSheetLayout, mmToCanonicalPx } from "../sheetLayout";

export interface ExpectedBubble {
  question: number;
  letter: string;
  xPx: number;
  yPx: number;
}

/**
 * Expected bubble centers in canonical-canvas pixel space, straight from the
 * calibrated (measured, not hand-derived) sheet geometry — see
 * scripts/calibrateSheetLayout.ts. No separate circle-detection pass is
 * needed to *find* the grid: the printed layout is deterministic per
 * preset, and the homography step already maps the photo onto this same
 * coordinate system.
 */
export function getExpectedBubbles(totalQuestions: number, pxPerMm: number): ExpectedBubble[] {
  const layout = getSheetLayout(totalQuestions);
  const bubbles: ExpectedBubble[] = [];

  for (const question of layout.questions) {
    for (const bubble of question.bubbles) {
      bubbles.push({
        question: question.question,
        letter: bubble.letter,
        xPx: mmToCanonicalPx(bubble.xMm, pxPerMm),
        yPx: mmToCanonicalPx(bubble.yMm, pxPerMm),
      });
    }
  }

  return bubbles;
}
