export interface OmrQuestionResult {
  question: number;
  /** Detected letter A-E, or "" when blank or ambiguous (double-marked). */
  letter: string;
  /** Fill ratio (0-1) for each bubble, in A-E order. */
  fillRatios: number[];
  ambiguous: boolean;
  lowConfidence: boolean;
}

export interface OmrResult {
  /** One entry per question, in order; "" where blank/ambiguous. */
  studentAnswers: string[];
  perQuestion: OmrQuestionResult[];
  warnings: string[];
}
