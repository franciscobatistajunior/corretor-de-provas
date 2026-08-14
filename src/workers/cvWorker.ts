/// <reference lib="webworker" />
import type { Cv } from "../lib/opencv/types";
import { toMarkerBinary } from "../lib/cv/preprocess";
import { findSquareBlobCandidates, classifyMarkers } from "../lib/cv/markerDetection";
import { runOmrPipeline, OmrPipelineError } from "../lib/cv/pipeline";

/**
 * All OpenCV.js work (loading the ~10MB WASM module and every Mat
 * operation) runs in here, off the main thread. A previous main-thread
 * implementation froze the entire tab — including DevTools — while
 * opencv.js loaded/compiled; a Worker's own thread can block all it wants
 * without touching the page's responsiveness.
 */

let cvPromise: Promise<Cv> | null = null;
const runInGlobalScope = globalThis.eval;

async function loadCv(): Promise<Cv> {
  if (cvPromise) return cvPromise;

  cvPromise = (async () => {
    // BASE_URL é "/" no desenvolvimento e "/corretor-de-provas/" no
    // GitHub Pages, evitando que o worker procure o OpenCV na raiz do domínio.
    const opencvUrl = `${import.meta.env.BASE_URL}opencv/opencv.js`;
    const response = await fetch(opencvUrl);
    if (!response.ok) {
      throw new Error(`Falha ao baixar opencv.js: ${response.status}`);
    }
    const scriptText = await response.text();
    runInGlobalScope(scriptText);

    const cv = (self as unknown as { cv?: Cv }).cv;
    if (!cv) {
      throw new Error("opencv.js carregou mas não expôs cv");
    }
    await new Promise<void>((resolve) => {
      cv.onRuntimeInitialized = resolve;
    });
    return cv;
  })();

  return cvPromise;
}

interface PreloadRequest {
  id: number;
  type: "preload";
}

interface DetectMarkersRequest {
  id: number;
  type: "detectMarkers";
  imageData: ImageData;
}

interface RunPipelineRequest {
  id: number;
  type: "runPipeline";
  imageData: ImageData;
  totalQuestions: number;
}

type CvWorkerRequest = PreloadRequest | DetectMarkersRequest | RunPipelineRequest;

self.onmessage = async (event: MessageEvent<CvWorkerRequest>) => {
  const request = event.data;

  try {
    const cv = await loadCv();

    switch (request.type) {
      case "preload": {
        postMessage({ id: request.id, ok: true });
        return;
      }

      case "detectMarkers": {
        const mat = cv.matFromImageData(request.imageData);
        const binary = toMarkerBinary(cv, mat);
        try {
          const candidates = findSquareBlobCandidates(cv, binary);
          const { markers, foundCorners } = classifyMarkers(candidates);
          postMessage({ id: request.id, ok: true, markers, foundCorners });
        } finally {
          mat.delete();
          binary.delete();
        }
        return;
      }

      case "runPipeline": {
        const output = runOmrPipeline(cv, request.imageData, request.totalQuestions);
        const warpedImageData = output.debug.warpedImageData;
        postMessage(
          {
            id: request.id,
            ok: true,
            result: output.result,
            foundCorners: output.debug.foundCorners,
            warpedImageData,
          },
          [warpedImageData.data.buffer]
        );
        return;
      }
    }
  } catch (error) {
    postMessage({
      id: request.id,
      ok: false,
      error: error instanceof OmrPipelineError ? error.message : String(error),
    });
  }
};
