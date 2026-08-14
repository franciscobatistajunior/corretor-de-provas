import { describe, expect, it } from "vitest";
import { examReducer, initialExamState } from "../../src/state/examReducer";
import type { ExamState } from "../../src/state/examReducer";
import type { OmrResult } from "../../src/lib/cv/types";

const fakeOmrResult: OmrResult = {
  studentAnswers: ["A", "", "C"],
  perQuestion: [
    { question: 1, letter: "A", fillRatios: [0.9, 0, 0, 0, 0], ambiguous: false, lowConfidence: false },
    { question: 2, letter: "", fillRatios: [0, 0, 0, 0, 0], ambiguous: false, lowConfidence: false },
    { question: 3, letter: "C", fillRatios: [0, 0, 0.6, 0.5, 0], ambiguous: false, lowConfidence: true },
  ],
  warnings: [],
};

describe("examReducer", () => {
  it("walks the full happy path from setup to results", () => {
    let state = initialExamState;

    state = examReducer(state, { type: "SET_TOTAL_QUESTIONS", totalQuestions: 5 });
    state = examReducer(state, { type: "SET_OFFICIAL_ANSWERS_RAW", raw: "A B C D E" });
    expect(state.officialAnswers).toEqual(["A", "B", "C", "D", "E"]);

    state = examReducer(state, { type: "GO_TO_CAPTURE" });
    expect(state.step).toBe("capture");

    state = examReducer(state, { type: "PHOTO_CAPTURED", dataUrl: "data:image/jpeg;base64,xxx" });
    expect(state.step).toBe("processing");
    expect(state.capturedImageDataUrl).toBe("data:image/jpeg;base64,xxx");

    state = examReducer(state, {
      type: "PROCESSING_SUCCEEDED",
      result: fakeOmrResult,
      debugImageUrl: "data:image/jpeg;base64,warped",
    });
    expect(state.step).toBe("review");
    expect(state.reviewedAnswers).toEqual(["A", "", "C"]);
    expect(state.debugWarpedImageUrl).toBe("data:image/jpeg;base64,warped");

    state = examReducer(state, { type: "UPDATE_REVIEWED_ANSWER", question: 2, letter: "B" });
    expect(state.reviewedAnswers).toEqual(["A", "B", "C"]);

    state = examReducer(state, { type: "CONFIRM_REVIEW" });
    expect(state.step).toBe("results");
    expect(state.compareResult).toEqual({
      acertos: 3,
      erros: 2,
      porcentagem: 60,
      wrongQuestions: [4, 5],
      totalQuestions: 5,
    });
  });

  it("routes processing failures back to capture with an error message, preserving the preset", () => {
    let state: ExamState = { ...initialExamState, totalQuestions: 10, step: "processing" };
    state = examReducer(state, { type: "PROCESSING_FAILED", error: "não achou os marcadores" });
    expect(state.step).toBe("capture");
    expect(state.error).toBe("não achou os marcadores");
  });

  it("RETAKE_PHOTO clears the captured photo, OMR result, and debug image", () => {
    let state = examReducer(initialExamState, {
      type: "PROCESSING_SUCCEEDED",
      result: fakeOmrResult,
      debugImageUrl: "data:image/jpeg;base64,warped",
    });
    state = examReducer(state, { type: "RETAKE_PHOTO" });
    expect(state.capturedImageDataUrl).toBeNull();
    expect(state.omrResult).toBeNull();
    expect(state.debugWarpedImageUrl).toBeNull();
    expect(state.step).toBe("capture");
  });

  it("RESTART resets to initial state but keeps the chosen question count", () => {
    const withPreset = examReducer(initialExamState, { type: "SET_TOTAL_QUESTIONS", totalQuestions: 30 });
    const restarted = examReducer(withPreset, { type: "RESTART" });
    expect(restarted).toEqual({ ...initialExamState, totalQuestions: 30 });
  });
});
