import { describe, expect, it } from "vitest";
import { compareAnswers, normalizeAnswers } from "../../src/lib/grading/compareAnswers";

describe("normalizeAnswers", () => {
  it("splits and uppercases free-text input, dropping empty tokens", () => {
    expect(normalizeAnswers("a, b;c   d")).toEqual(["A", "B", "C", "D"]);
  });

  it("returns an empty array for blank or non-string free text", () => {
    expect(normalizeAnswers("   ")).toEqual([]);
    // @ts-expect-error exercising the non-string fallback on purpose
    expect(normalizeAnswers(undefined)).toEqual([]);
  });

  it("preserves blanks and array length for OMR-style array input", () => {
    expect(normalizeAnswers(["a", "", "c", "", "e"])).toEqual(["A", "", "C", "", "E"]);
  });
});

describe("compareAnswers", () => {
  it("counts hits, misses, and wrong question numbers (1-indexed)", () => {
    const result = compareAnswers("A B C D E", "A X C X E");
    expect(result).toEqual({
      acertos: 3,
      erros: 2,
      porcentagem: 60,
      wrongQuestions: [2, 4],
      totalQuestions: 5,
    });
  });

  it("treats a blank OMR answer in the middle of the array as wrong, without shifting later indexes", () => {
    const official = "A B C D E";
    const student = ["A", "B", "", "D", "E"]; // question 3 left blank
    const result = compareAnswers(official, student);
    expect(result.wrongQuestions).toEqual([3]);
    expect(result.acertos).toBe(4);
  });

  it("never counts a hit when the official answer itself is blank", () => {
    const result = compareAnswers(["A", ""], ["A", ""]);
    expect(result.wrongQuestions).toEqual([2]);
    expect(result.acertos).toBe(1);
  });

  it("returns all-zero results for empty input", () => {
    expect(compareAnswers("", "")).toEqual({
      acertos: 0,
      erros: 0,
      porcentagem: 0,
      wrongQuestions: [],
      totalQuestions: 0,
    });
  });

  it("scores 100% when everything matches", () => {
    const result = compareAnswers("A B C", "A B C");
    expect(result.porcentagem).toBe(100);
    expect(result.wrongQuestions).toEqual([]);
  });

  it("uses expectedTotalQuestions as the authoritative count over inferred length", () => {
    const result = compareAnswers("A B", ["A", "B", "C"], 2);
    expect(result.totalQuestions).toBe(2);
    expect(result.wrongQuestions).toEqual([]);
  });
});
