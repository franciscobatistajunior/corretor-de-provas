/**
 * End-to-end check for the CV pipeline against a synthetic sheet (see
 * test/fixtures/syntheticSheet.ts) rendered and processed inside a real
 * browser (opencv.js needs real WASM + Canvas, which plain Vitest/Node
 * can't provide). Starts a throwaway Vite dev server, drives headless
 * Chromium against the test harness page, and asserts the pipeline
 * recovers the known ground-truth answer key.
 *
 * This is intentionally separate from `npm test` (fast, Node-only unit
 * tests) — run it with `npm run test:e2e`.
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import type { RunTestOptions, RunTestResult } from "../browser/omrHarness";

const LETTERS = ["A", "B", "C", "D", "E"];

interface TestCase {
  name: string;
  options: RunTestOptions;
  expected: string[];
}

function buildCase(totalQuestions: number, angleDeg: number): TestCase {
  const answers = Array.from({ length: totalQuestions }, (_, i) => LETTERS[i % 5]);
  const doubleMarked = totalQuestions >= 2 ? [2] : [];

  const expected = [...answers];
  expected[0] = ""; // question 1: left blank
  answers[0] = "";
  if (doubleMarked.length > 0) {
    expected[1] = ""; // question 2: double-marked -> ambiguous -> blank
  }

  return {
    name: `${totalQuestions} questões, inclinação ${angleDeg}°`,
    options: { totalQuestions, answers, doubleMarked, angleDeg },
    expected,
  };
}

async function main() {
  const presets = [5, 8, 10, 20, 30, 50];
  const cases: TestCase[] = [
    ...presets.map((preset) => buildCase(preset, 0)),
    buildCase(10, 4),
    buildCase(30, -3),
  ];

  const server = await createServer({ server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Não foi possível obter a URL do servidor de desenvolvimento Vite.");

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error("[pageerror]", error));

  await page.goto(`${url}test/browser/omrHarness.html`);
  await page.waitForFunction(() => (window as unknown as { __omrHarnessReady?: boolean }).__omrHarnessReady === true, {
    timeout: 30000,
  });

  let failures = 0;
  const PER_CASE_TIMEOUT_MS = 30000;

  for (const testCase of cases) {
    let result: RunTestResult;
    try {
      result = await Promise.race([
        page.evaluate(
          (options) =>
            (window as unknown as { __runOmrTest: (o: RunTestOptions) => Promise<RunTestResult> }).__runOmrTest(
              options
            ),
          testCase.options
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`sem resposta em ${PER_CASE_TIMEOUT_MS}ms`)), PER_CASE_TIMEOUT_MS)
        ),
      ]);
    } catch (error) {
      failures += 1;
      console.log(`FAIL - ${testCase.name}`);
      console.log(`       ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const matches = result.ok && JSON.stringify(result.studentAnswers) === JSON.stringify(testCase.expected);

    if (matches) {
      console.log(`OK   - ${testCase.name}`);
    } else {
      failures += 1;
      console.log(`FAIL - ${testCase.name}`);
      console.log(`       esperado: ${JSON.stringify(testCase.expected)}`);
      console.log(`       obtido:   ${JSON.stringify(result.studentAnswers)}`);
      if (result.error) console.log(`       erro: ${result.error}`);
      if (result.warnings?.length) console.log(`       avisos: ${result.warnings.join(" | ")}`);
    }
  }

  await browser.close();
  await server.close();

  if (failures > 0) {
    console.error(`\n${failures} de ${cases.length} caso(s) falharam.`);
    process.exitCode = 1;
  } else {
    console.log(`\nTodos os ${cases.length} casos passaram.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
