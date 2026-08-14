import { getSheetLayout } from "../../src/lib/sheetLayout";

export interface SyntheticSheetOptions {
  totalQuestions: number;
  pxPerMm: number;
  /** One letter (or "") per question, in question order. */
  answers: string[];
  /** Question numbers (1-indexed) that should get two filled bubbles instead of one. */
  doubleMarked?: number[];
}

const MARKER_SIZE_MM: Record<string, number> = {
  cornerTopLeft: 11,
  cornerTopRight: 11,
  cornerBottomLeft: 11,
  cornerBottomRight: 11,
  midTop: 8,
  midBottom: 8,
  midLeft: 8,
  midRight: 8,
};

const BUBBLE_RADIUS_MM = 1.85;

/**
 * Draws a sheet with 100%-known ground truth (marker + bubble positions come
 * straight from the same calibrated sheetLayout data the real pipeline
 * uses) onto a canvas, for testing the CV pipeline without a printer or
 * camera. Mirrors the real generator's visual conventions (solid black
 * squares for markers, printed-outline circles for bubbles) closely enough
 * for contour/threshold-based detection to behave the same way it would on
 * a real photo.
 */
export function drawSyntheticSheet(canvas: HTMLCanvasElement, options: SyntheticSheetOptions): void {
  const { totalQuestions, pxPerMm, answers, doubleMarked = [] } = options;
  const layout = getSheetLayout(totalQuestions);

  canvas.width = Math.round(190 * pxPerMm);
  canvas.height = Math.round(277 * pxPerMm);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "black";
  for (const [id, point] of Object.entries(layout.markers)) {
    const sizePx = MARKER_SIZE_MM[id] * pxPerMm;
    ctx.fillRect(point.xMm * pxPerMm - sizePx / 2, point.yMm * pxPerMm - sizePx / 2, sizePx, sizePx);
  }

  const outerRadiusPx = BUBBLE_RADIUS_MM * pxPerMm;
  const innerRadiusPx = outerRadiusPx * 0.6;

  layout.questions.forEach((question, index) => {
    const isDouble = doubleMarked.includes(question.question);
    const answer = answers[index] ?? "";

    question.bubbles.forEach((bubble, letterIndex) => {
      const cx = bubble.xMm * pxPerMm;
      const cy = bubble.yMm * pxPerMm;

      ctx.beginPath();
      ctx.arc(cx, cy, outerRadiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = Math.max(1, pxPerMm * 0.26);
      ctx.stroke();

      const shouldFill = isDouble ? letterIndex < 2 : bubble.letter === answer;
      if (shouldFill) {
        ctx.beginPath();
        ctx.arc(cx, cy, innerRadiusPx, 0, Math.PI * 2);
        ctx.fillStyle = "black";
        ctx.fill();
      }
    });
  });
}
