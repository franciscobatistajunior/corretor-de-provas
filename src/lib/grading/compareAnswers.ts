import type { CompareResult } from "./types";

/**
 * Normalizes an answer key/response set into an array of single letters.
 *
 * Two input shapes are supported because they come from different sources:
 * - `string` (free-text input, e.g. the teacher's official-answer textarea):
 *   uppercased, separators collapsed, split into tokens, empty tokens dropped.
 * - `string[]` (OMR pipeline output): each entry is upper-cased/trimmed but
 *   NEVER dropped, even if empty — a blank/ambiguous bubble read is a `''`
 *   at a specific question index, and filtering it out would shift every
 *   later question's index.
 */
export function normalizeAnswers(rawValue: string | string[]): string[] {
  if (Array.isArray(rawValue)) {
    return rawValue.map((value) => String(value ?? "").toUpperCase().trim());
  }

  if (typeof rawValue !== "string") {
    return [];
  }

  const cleaned = rawValue
    .toUpperCase()
    .replace(/[\s,;]+/g, " ")
    .trim();

  if (!cleaned) {
    return [];
  }

  return cleaned.split(/\s+/).filter(Boolean);
}

export function compareAnswers(
  officialAnswers: string | string[],
  studentAnswers: string | string[],
  expectedTotalQuestions?: number
): CompareResult {
  const official = normalizeAnswers(officialAnswers);
  const student = normalizeAnswers(studentAnswers);
  const totalQuestions = expectedTotalQuestions ?? Math.max(official.length, student.length);

  let hits = 0;
  const wrongQuestions: number[] = [];

  for (let index = 0; index < totalQuestions; index += 1) {
    const officialAnswer = official[index] || "";
    const studentAnswer = student[index] || "";

    if (officialAnswer && officialAnswer === studentAnswer) {
      hits += 1;
    } else {
      wrongQuestions.push(index + 1);
    }
  }

  const errors = totalQuestions - hits;
  const percentage = totalQuestions === 0 ? 0 : Math.round((hits / totalQuestions) * 100);

  return {
    acertos: hits,
    erros: errors,
    porcentagem: percentage,
    wrongQuestions,
    totalQuestions,
  };
}
