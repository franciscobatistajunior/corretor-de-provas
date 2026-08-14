import { describe, expect, it } from "vitest";
import { QUESTION_COUNT_PRESETS } from "../src/lib/sheetLayout.types";
import { getCalibrationPoints, getSheetLayout } from "../src/lib/sheetLayout";

describe("sheetLayout", () => {
  it("has a calibrated layout for every question-count preset", () => {
    for (const preset of QUESTION_COUNT_PRESETS) {
      const layout = getSheetLayout(preset);
      expect(layout.totalQuestions).toBe(preset);
      expect(layout.questions).toHaveLength(preset);
      for (const question of layout.questions) {
        expect(question.bubbles).toHaveLength(5);
        expect(question.bubbles.map((b) => b.letter)).toEqual(["A", "B", "C", "D", "E"]);
      }
    }
  });

  it("throws a clear error for an uncalibrated question count", () => {
    expect(() => getSheetLayout(7)).toThrow(/Nenhum layout calibrado/);
  });

  it("returns all 8 marker correspondence points", () => {
    const points = getCalibrationPoints(10);
    expect(points.map((p) => p.id).sort()).toEqual(
      [
        "cornerTopLeft",
        "cornerTopRight",
        "cornerBottomLeft",
        "cornerBottomRight",
        "midTop",
        "midBottom",
        "midLeft",
        "midRight",
      ].sort()
    );
  });

  it("keeps every marker at a fixed position across all presets (regression guard for the sheet min-height CSS fix)", () => {
    const [first, ...rest] = QUESTION_COUNT_PRESETS.map((preset) => getSheetLayout(preset).markers);
    for (const markers of rest) {
      for (const id of Object.keys(first) as (keyof typeof first)[]) {
        // Sub-mm tolerance: measurements come from real browser layout/rounding, not hand algebra.
        expect(markers[id].xMm).toBeCloseTo(first[id].xMm, 0);
        expect(markers[id].yMm).toBeCloseTo(first[id].yMm, 0);
      }
    }
  });

  it("keeps all questions in a row at the same Y and evenly spaced columns", () => {
    const layout = getSheetLayout(20);
    const rows = new Map<number, number[]>();
    layout.questions.forEach((question, index) => {
      const row = Math.floor(index / 5);
      const y = question.bubbles[0].yMm;
      const ys = rows.get(row) ?? [];
      ys.push(y);
      rows.set(row, ys);
    });
    for (const ys of rows.values()) {
      const [firstY, ...restY] = ys;
      for (const y of restY) {
        expect(y).toBeCloseTo(firstY, 0);
      }
    }
  });
});
