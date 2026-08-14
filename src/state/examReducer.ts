import { compareAnswers, normalizeAnswers } from "../lib/grading/compareAnswers";
import type { CompareResult } from "../lib/grading/types";
import type { OmrResult } from "../lib/cv/types";
import type { QuestionCountPreset } from "../lib/sheetLayout.types";

export type Step = "setup" | "capture" | "processing" | "review" | "results";

export interface ExamState {
  step: Step;
  totalQuestions: QuestionCountPreset;
  officialAnswersRaw: string;
  officialAnswers: string[];
  capturedImageDataUrl: string | null;
  omrResult: OmrResult | null;
  /** Aligned, top-down preview of the sheet produced by the pipeline — lets
   * the teacher sanity-check the alignment on the Review screen. */
  debugWarpedImageUrl: string | null;
  reviewedAnswers: string[];
  compareResult: CompareResult | null;
  error: string | null;
}

export const initialExamState: ExamState = {
  step: "setup",
  totalQuestions: 10,
  officialAnswersRaw: "",
  officialAnswers: [],
  capturedImageDataUrl: null,
  omrResult: null,
  debugWarpedImageUrl: null,
  reviewedAnswers: [],
  compareResult: null,
  error: null,
};

export type ExamAction =
  | { type: "SET_TOTAL_QUESTIONS"; totalQuestions: QuestionCountPreset }
  | { type: "SET_OFFICIAL_ANSWERS_RAW"; raw: string }
  | { type: "GO_TO_CAPTURE" }
  | { type: "PHOTO_CAPTURED"; dataUrl: string }
  | { type: "PROCESSING_SUCCEEDED"; result: OmrResult; debugImageUrl: string }
  | { type: "PROCESSING_FAILED"; error: string }
  | { type: "RETAKE_PHOTO" }
  | { type: "UPDATE_REVIEWED_ANSWER"; question: number; letter: string }
  | { type: "CONFIRM_REVIEW" }
  | { type: "RESTART" };

export function examReducer(state: ExamState, action: ExamAction): ExamState {
  switch (action.type) {
    case "SET_TOTAL_QUESTIONS":
      return { ...state, totalQuestions: action.totalQuestions };

    case "SET_OFFICIAL_ANSWERS_RAW":
      return {
        ...state,
        officialAnswersRaw: action.raw,
        officialAnswers: normalizeAnswers(action.raw),
      };

    case "GO_TO_CAPTURE":
      return { ...state, step: "capture", error: null };

    case "PHOTO_CAPTURED":
      return { ...state, capturedImageDataUrl: action.dataUrl, step: "processing", error: null };

    case "PROCESSING_SUCCEEDED":
      return {
        ...state,
        omrResult: action.result,
        debugWarpedImageUrl: action.debugImageUrl,
        reviewedAnswers: [...action.result.studentAnswers],
        step: "review",
      };

    case "PROCESSING_FAILED":
      return { ...state, error: action.error, step: "capture" };

    case "RETAKE_PHOTO":
      return {
        ...state,
        capturedImageDataUrl: null,
        omrResult: null,
        debugWarpedImageUrl: null,
        step: "capture",
        error: null,
      };

    case "UPDATE_REVIEWED_ANSWER": {
      const reviewedAnswers = [...state.reviewedAnswers];
      reviewedAnswers[action.question - 1] = action.letter;
      return { ...state, reviewedAnswers };
    }

    case "CONFIRM_REVIEW": {
      const compareResult = compareAnswers(state.officialAnswers, state.reviewedAnswers, state.totalQuestions);
      return { ...state, compareResult, step: "results" };
    }

    case "RESTART":
      return { ...initialExamState, totalQuestions: state.totalQuestions };

    default:
      return state;
  }
}
