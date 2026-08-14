import { drawSyntheticSheet } from "../fixtures/syntheticSheet";
import { runOmrPipeline, OmrPipelineError } from "../../src/lib/cv/pipeline";
import type { Cv } from "../../src/lib/opencv/types";

// The real app loads opencv.js inside a Worker (src/workers/cvWorker.ts) so
// a slow/blocking load can't freeze the page. This test harness exercises
// the pipeline algorithm itself (same functions the worker calls) directly
// on the main thread of a throwaway test page, so it just waits on the
// plain <script> tag in omrHarness.html instead of going through the
// worker — simpler, and the algorithm's correctness doesn't depend on
// which thread it runs on.
function waitForOpenCv(): Promise<Cv> {
  return new Promise((resolve, reject) => {
    const cv = (window as unknown as { cv?: Cv }).cv;
    if (!cv) {
      reject(new Error("opencv.js não carregou (verifique a tag <script> em omrHarness.html)"));
      return;
    }
    cv.onRuntimeInitialized = () => resolve(cv);
  });
}

export interface RunTestOptions {
  totalQuestions: number;
  answers: string[];
  doubleMarked?: number[];
  angleDeg?: number;
  pxPerMm?: number;
}

export interface RunTestResult {
  ok: boolean;
  studentAnswers?: string[];
  warnings?: string[];
  foundCorners?: number;
  error?: string;
}

declare global {
  interface Window {
    __runOmrTest: (options: RunTestOptions) => Promise<RunTestResult>;
    __omrHarnessReady?: boolean;
  }
}

window.__runOmrTest = async ({ totalQuestions, answers, doubleMarked = [], angleDeg = 0, pxPerMm = 6 }) => {
  try {
    const sheetCanvas = document.getElementById("sheet") as HTMLCanvasElement;
    drawSyntheticSheet(sheetCanvas, { totalQuestions, pxPerMm, answers, doubleMarked });

    // Simulate a photographed sheet: extra background margin (like a desk)
    // plus a small rotation, mimicking a handheld, not-perfectly-square photo.
    const pad = Math.round(30 * pxPerMm);
    const photoCanvas = document.getElementById("photo") as HTMLCanvasElement;
    photoCanvas.width = sheetCanvas.width + pad * 2;
    photoCanvas.height = sheetCanvas.height + pad * 2;

    const ctx = photoCanvas.getContext("2d")!;
    ctx.fillStyle = "#999999";
    ctx.fillRect(0, 0, photoCanvas.width, photoCanvas.height);
    ctx.save();
    ctx.translate(photoCanvas.width / 2, photoCanvas.height / 2);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.drawImage(sheetCanvas, -sheetCanvas.width / 2, -sheetCanvas.height / 2);
    ctx.restore();

    const cv = await waitForOpenCv();
    const imageData = ctx.getImageData(0, 0, photoCanvas.width, photoCanvas.height);
    const output = runOmrPipeline(cv, imageData, totalQuestions);

    return {
      ok: true,
      studentAnswers: output.result.studentAnswers,
      warnings: output.result.warnings,
      foundCorners: output.debug.foundCorners,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof OmrPipelineError ? error.message : String(error),
    };
  }
};

window.__omrHarnessReady = true;
