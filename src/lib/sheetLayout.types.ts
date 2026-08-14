export interface MarkerPoint {
  xMm: number;
  yMm: number;
}

export interface BubblePoint {
  letter: string;
  xMm: number;
  yMm: number;
}

export interface QuestionRow {
  question: number;
  bubbles: BubblePoint[];
}

export interface SheetMarkers {
  cornerTopLeft: MarkerPoint;
  cornerTopRight: MarkerPoint;
  cornerBottomLeft: MarkerPoint;
  cornerBottomRight: MarkerPoint;
  midTop: MarkerPoint;
  midBottom: MarkerPoint;
  midLeft: MarkerPoint;
  midRight: MarkerPoint;
}

export interface SheetPresetLayout {
  totalQuestions: number;
  markers: SheetMarkers;
  questions: QuestionRow[];
}

export const QUESTION_COUNT_PRESETS = [5, 8, 10, 20, 30, 50] as const;
export type QuestionCountPreset = (typeof QUESTION_COUNT_PRESETS)[number];
