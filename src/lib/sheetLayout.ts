import { SHEET_PRESET_LAYOUTS } from "./sheetLayout.data";
import type { SheetMarkers, SheetPresetLayout } from "./sheetLayout.types";

export { QUESTION_COUNT_PRESETS } from "./sheetLayout.types";
export type { QuestionCountPreset, SheetPresetLayout, SheetMarkers, QuestionRow, BubblePoint, MarkerPoint } from "./sheetLayout.types";

export type MarkerId = keyof SheetMarkers;

export interface CalibrationPoint {
  id: MarkerId;
  xMm: number;
  yMm: number;
}

/** Returns the calibrated layout (measured by scripts/calibrateSheetLayout.ts) for a preset. */
export function getSheetLayout(totalQuestions: number): SheetPresetLayout {
  const layout = SHEET_PRESET_LAYOUTS[totalQuestions];
  if (!layout) {
    const available = Object.keys(SHEET_PRESET_LAYOUTS).join(", ");
    throw new Error(
      `Nenhum layout calibrado para ${totalQuestions} questões (presets disponíveis: ${available}). ` +
        `Rode "npm run calibrate" se um novo preset foi adicionado ao gerador-de-gabarito.`
    );
  }
  return layout;
}

/** The 8 physical markers as a flat list of correspondence points, for feeding cv.findHomography. */
export function getCalibrationPoints(totalQuestions: number): CalibrationPoint[] {
  const { markers } = getSheetLayout(totalQuestions);
  return (Object.entries(markers) as [MarkerId, { xMm: number; yMm: number }][]).map(([id, point]) => ({
    id,
    xMm: point.xMm,
    yMm: point.yMm,
  }));
}

/** Converts a physical mm coordinate to pixel coordinates in a canonical canvas at the given px/mm scale. */
export function mmToCanonicalPx(mm: number, pxPerMm: number): number {
  return mm * pxPerMm;
}
